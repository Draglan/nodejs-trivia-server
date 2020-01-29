const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const user = require('./user');
const trivia = require('./trivia-room');

// Serve static files from the current working directory.
app.use(express.static('.'));

// Parse JSON requests.
app.use(bodyParser);

// The list of possible questions.
var allQuestions = [];

// Represents a trivia question.
class TriviaQuestion 
{
    constructor(question, answers, correctAnswerIndex) 
    {
        this.question           = question;
        this.answers            = answers;
        this.correctAnswerIndex = correctAnswerIndex;
    }
}

// Initialize all of the possible questions.
for (let i=0; i<10; ++i) 
{
    allQuestions.push(new TriviaQuestion(`Question ${i}`, ['Answer 1', 'Answer 2', 'Answer 3'], 0));
}

// Initialize the first question.
let currentQuestion;
setNewQuestion();

// Return a random question from the list of all questions.
function getNewQuestion(questionList)
{
    let i = Math.floor(Math.random() * questionList.length);
    return questionList[i];
}

// Set the current question.
function setNewQuestion() {
    // Reset all of the user's selected answers and
    // tell them if they got the answer right or wrong.
    user.allUsers.forEach
    (
        (user) => 
        {
            user.socket.emit('answer result', user.answerIndex === currentQuestion.correctAnswerIndex);
            user.unselectAnswer();
        }
    );

    currentQuestion = getNewQuestion(allQuestions);
    io.emit('set question', currentQuestion);

}

// Question timer
//

// Number of seconds left on the current question.
let maxSeconds = 15;
let seconds = maxSeconds;

// Decrement the second count and set a new trivia question
// when the timer runs out.
function timer()
{
    if (seconds === 0) {
        seconds = maxSeconds;
        io.emit('seconds left', --seconds);
        setNewQuestion();
    }
    else {
        io.emit('seconds left', --seconds);
    }

    setTimeout(timer, 1000);
}

// Start question timer.
setTimeout(timer, 1000);
io.emit('seconds left', seconds);

io.on
(
    'connection', 
    (socket) => 
    {
        let newUser = new user.User(socket, `User${user.allUsers.length}`)
        user.allUsers.push(newUser);
        socket.emit('set question', currentQuestion);
        io.emit('join', newUser.nickname);
        console.log(`${newUser.nickname} connected.`);
    }
);

console.log("Listening on port 3000...");
http.listen(3000);
