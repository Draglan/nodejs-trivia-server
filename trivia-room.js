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
    NEW_ROOM   : 'newRoom',   // Args: the room that was created
    DELETE_ROOM: 'deleteRoom' // Args: the room that was deleted
}

// Represents a trivia question.
class TriviaQuestion 
{
    constructor(question, answers, correctAnswerIndex) 
    {
        this.question           = question;
        this.answers            = answers;
        this.correctAnswerIndex = correctAnswerIndex;
        this.category           = '';
        this.difficulty         = '';
    }
}

// Represents a room in which trivia players play a 
// session. Each room represents a separate game of
// trivia.
class TriviaRoom extends RoomBase
{
    constructor(ioInstance, deleteOnLastUser = true)
    {
        super(ioInstance);

        this.maxSeconds       = 30;
        this.id               = generateId();
        this.timerId          = -1;
        this.secondsLeft      = this.maxSeconds;
        this.currentQuestion  = null;
        this.deleteOnLastUser = deleteOnLastUser;

        this.requestNewQuestion();
    }

    // Add a user to the room.
    addUser(user)
    {
        super.addUser(user);
        this.sendCurrentQuestionToUser(user);
        this.sendEnteredGameRoom(user);
    }

    // Remove the given user from the room.
    removeUser(user)
    {
        super.removeUser(user);
        this.sendLeftGameRoom(user);

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
                    console.log(`Sending answer result to ${user.nickname}`);
                    user.socket.emit('answer result', user.answerIndex === this.currentQuestion.correctAnswerIndex)
                    user.unselectAnswer();
                }
            );
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
            (q) => 
            {
                this.setNewQuestion(q);
                this.timerId = setTimeout(timer, 1000, this);
            },
            (e) => console.log(e)
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
function makeNewRoom(ioInstance, deleteOnLastUser = true)
{
    let room            = new TriviaRoom(ioInstance, deleteOnLastUser);
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
module.exports.makeNewRoom        = makeNewRoom;
module.exports.getRoomById        = getRoomById;
module.exports.getRoomIdList      = getRoomIdList;
module.exports.triviaEventEmitter = triviaEventEmitter;
module.exports.events             = events;