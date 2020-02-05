const questionSource = require('./question-source');
const RoomBase       = require('./roombase');
const EventEmitter   = require('events');

// A map of all of the active rooms.
let rooms = {};

// An EventEmitter that other modules can subscribe to
// in order to receive events about room creation,
// deletion, etc.
class TriviaEventEmitter extends EventEmitter {}
const triviaEventEmitter = new TriviaEventEmitter();

// Trivia room event names
const events = 
{
    NEW_ROOM   : 'newRoom',    // Args: the room that was created
    DELETE_ROOM: 'deleteRoom', // Args: the room that was deleted
    UPDATE_ROOM: 'updateRoom'  // Args: the room that was updated
}

// The different levels of difficulty.
const difficulty =
{
    EASY  : 'easy',
    MEDIUM: 'medium',
    HARD  : 'hard'
}

// Represents a trivia question.
class TriviaQuestion 
{
    constructor(question, answers, correctAnswerIndex) 
    {
        this.question           = question;
        this.answers            = answers;
        this.correctAnswerIndex = correctAnswerIndex;
        this.categoryName       = '';
        this.difficulty         = difficulty.MEDIUM;
    }

    getPointValue()
    {
        switch (this.difficulty)
        {
            case difficulty.EASY  : return 10;
            case difficulty.MEDIUM: return 25;
            case difficulty.HARD  : return 50;
            default               : return 0;
        }
    }
}

/*
    Represents a trivia category.
*/
class Category
{
    constructor(id = 0, name = '')
    {
        this.id   = id;
        this.name = name;
    }
}

/*
    The stats of a given user, like points, number
    of questions right/wrong, etc.
*/
class UserStatistics
{
    constructor(points = 0, numCorrect = 0, numWrong = 0)
    {
        this.points         = points;
        this.questionsRight = numCorrect;
        this.questionsWrong = numWrong;
    }
}

/*
    The rules a particular room abides by.
*/
class RoomConfiguration
{
    constructor(category = null, difficulty = null)
    {
        this.category   = category;   // null if no category
        this.difficulty = difficulty; // easy, medium, hard, or null
    }

    // Returns true if the room is set to a specific category, or false
    // if the room is for any category.
    hasCategory()
    {
        return this.category != null;
    }

    // Returns true if the room is set to a specific difficulty (easy, medium,
    // or hard), or false if the room is for any difficulty.
    hasDifficulty()
    {
        return this.difficulty != null;
    }
}

// Represents a room in which trivia players play a 
// session. Each room represents a separate game of
// trivia.
class TriviaRoom extends RoomBase
{
    constructor(ioInstance, name, deleteOnLastUser = true, config)
    {
        super(ioInstance);

        this.maxSeconds       = 30;
        this.id               = generateId();
        this.name             = name;
        this.timerId          = -1;
        this.secondsLeft      = this.maxSeconds;
        this.currentQuestion  = null;
        this.deleteOnLastUser = deleteOnLastUser;
        this.config           = config;

        // Maps usernames to the stats each user has.
        this.userStats = {};

        this.requestNewQuestion();
    }

    // Add a user to the room.
    addUser(user)
    {
        super.addUser(user);
        this.userStats[user.nickname] = new UserStatistics();

        this.sendCurrentQuestionToUser(user);
        this.sendEnteredGameRoom(user);
        this.sendUserStatsToAll(user);

        triviaEventEmitter.emit(events.UPDATE_ROOM, this);
    }

    // Remove the given user from the room.
    removeUser(user)
    {
        super.removeUser(user);
        delete this.userStats[user.nickname];

        this.sendLeftGameRoom(user);
        this.sendUserStatsToAll(user);

        // If this was the last user, remove this room
        // from the room list and stop the timer.
        if (this.users.length === 0 && this.deleteOnLastUser)
        {
            delete rooms[this.id];
            clearTimeout(this.timerId);
            this.timerId = -1;
            triviaEventEmitter.emit(events.DELETE_ROOM, this);
            console.log(`Deleted room ${this.id}.`);
        }
        else
        {
            triviaEventEmitter.emit(events.UPDATE_ROOM, this);
        }
    }

    // Tell each connected user if their answer was right or wrong
    // and reset their selected answer.
    sendAnswerResultAndResetSelection()
    {
        if (this.currentQuestion)
        {
            this.users.forEach
            (
                (user) => 
                {
                    let result = user.answerIndex === this.currentQuestion.correctAnswerIndex;
                    let stats = this.userStats[user.nickname];

                    // Give/take points to/from the user.
                    if (result) 
                    {
                        stats.points += this.currentQuestion.getPointValue();
                        ++stats.questionsRight;
                    }
                    else
                    {
                        stats.points -= this.currentQuestion.getPointValue();
                        ++stats.questionsWrong;
                    }

                    // Prevent points from going below 0.
                    if (stats.points < 0) stats.points = 0;

                    // Send the result and de-select their answer.
                    console.log(`Sending answer result to ${user.nickname}. Result: ${result ? 'Correct' : 'Incorrect'}.`);
                    user.socket.emit('answer result', result)
                    user.unselectAnswer();
                }
            );

            // Notify users of the changes.
            this.sendUserStatsToAll();
        }
    }

    // Tell each connected user how many seconds are left until the
    // current question ends.
    sendSecondsLeft()
    {
        this.io.to(this.id).emit('seconds left', this.secondsLeft);
    }

    // Send the current question to a specific user.
    sendCurrentQuestionToUser(user)
    {
        if (this.currentQuestion)
        {
            user.socket.emit('set question', this.currentQuestion);
        }
    }

    // Tell the given user they have entered this room.
    sendEnteredGameRoom(user)
    {
        user.socket.emit('entered game room', this.id);
    }

    // Tell the given user they have left this room.
    sendLeftGameRoom(user)
    {
        user.socket.emit('left game room');
    }

    // Notify all users in the room of point total changes for each user.
    // For example, if everyone now has 100 points, that change would be reflected
    // here.
    sendUserStatsToAll()
    {
        let updates = this.getUserStats();
        this.io.to(this.id).emit('set user stats', updates);
    }

    // Send the point totals to a specific user.
    sendUserStatsToOne(user)
    {
        let updates = this.getUserStats();
        user.socket.emit('set user stats', updates);
    }

    // Compile the stats of all the users.
    getUserStats()
    {
        let updates = [];
        this.users.forEach
        (
            u => 
            updates.push
            (
                {
                    nickname: u.nickname,
                    ...this.userStats[u.nickname]
                }
            )
        );

        return updates;
    }

    // Set the current question.
    setNewQuestion(question) 
    {
        // Reset all of the user's selected answers and
        // tell them if they got the answer right or wrong.
        this.sendAnswerResultAndResetSelection();

        this.currentQuestion = question;
        this.io.to(this.id).emit('set question', this.currentQuestion);
    }

    // Request a new question from the question source.
    // Once a question is available, this method calls
    // setNewQuestion() to actually assign the new question.
    requestNewQuestion()
    {
        questionSource.getTriviaQuestionAsync
        (
            this,
            (q) => 
            {
                this.setNewQuestion(q);
                this.timerId = setTimeout(timer, 1000, this);
            },
            (e) => console.log(`Question retrieval error: ${e}`)
        );
    }
}

// Randomly generate a 5-character string that represents a room.
// Collisions aren't checked for - that could never happen, right???!!
function generateId() 
{
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let   id       = '';

    for (let i = 0; i < 5; ++i) 
        id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));

    return id;
}

// Make a new trivia room. ioInstance is the socket.io handle,
// and is needed by the room to send and receive messages.
function makeNewRoom(ioInstance, name, deleteOnLastUser = true, difficulty = null, categoryId = null)
{
    // Translate the category ID into a Category object.
    let category = questionSource.getCategoryById(categoryId);
    let config   = new RoomConfiguration(category, difficulty);
    let room     = new TriviaRoom(ioInstance, name, deleteOnLastUser, config);

    rooms[room.getId()] = room;

    triviaEventEmitter.emit(events.NEW_ROOM, room);
    return room;
}

// Return the room with the given id, or null if no such room
// exists.
function getRoomById(id)
{
    if (id in rooms) return rooms[id];
    else             return null;
}

// Return an array of the IDs of all of the currently active rooms.
function getRoomIdList()
{
    return Object.keys(rooms);
}

// Decrement the second count and set a new trivia question
// when the timer runs out.
function timer(room)
{
    if (room.secondsLeft === 0) 
    {
        room.secondsLeft = room.maxSeconds;
        room.io.to(room.id).emit('seconds left', --room.secondsLeft);
        room.requestNewQuestion();
    }
    else 
    {
        room.io.to(room.id).emit('seconds left', --room.secondsLeft);
        room.timerId = setTimeout(timer, 1000, room);
    }
}

// Export the trivia API.
//

module.exports.TriviaRoom         = TriviaRoom;
module.exports.TriviaQuestion     = TriviaQuestion;
module.exports.RoomConfiguration  = RoomConfiguration;
module.exports.makeNewRoom        = makeNewRoom;
module.exports.getRoomById        = getRoomById;
module.exports.getRoomIdList      = getRoomIdList;
module.exports.triviaEventEmitter = triviaEventEmitter;
module.exports.events             = events;
module.exports.difficulty         = difficulty;