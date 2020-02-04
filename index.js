const express    = require('express');
const app        = express();
const http       = require('http').createServer(app);
const io         = require('socket.io')(http);
const bodyParser = require('body-parser');
const user       = require('./user');
const trivia     = require('./trivia-room');
const Lobby      = require('./lobby');
const questions  = require('./question-source');

// Serve static files from the current working directory.
app.use(express.static('.'));

// Parse JSON requests.
app.use(bodyParser);

// Initialize the User Module.
user.init(io);

let lobby = new Lobby(io);

// Create a bunch of test rooms. Stagger them over time.
/*
for (let i=0; i<3; ++i)
{
    setTimeout(trivia.makeNewRoom, 10000*i, io, false);
}
*/

// Output a list of all of the available categories. For debugging purposes.
questions.getCategories().then((categories) => console.log(categories));

io.on
(
    'connection', 
    (socket) => 
    {
        let newUser = new user.User(socket, '', lobby);
        user.allUsers.push(newUser);
        newUser.socket.emit('need nickname');
        console.log("User connected.");
    }
);

console.log('Trivia server active on port 3000.');
http.listen(3000);
