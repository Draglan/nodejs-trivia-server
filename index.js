const express    = require('express');
const app        = express();
const http       = require('http').createServer(app);
const io         = require('socket.io')(http);
const bodyParser = require('body-parser');
const user       = require('./user');
const trivia     = require('./trivia-room');
const Lobby      = require('./lobby');

// Serve static files from the current working directory.
app.use(express.static('.'));

// Parse JSON requests.
app.use(bodyParser);

// Initialize the User Module.
user.init(io);

let userTag = 0;
let lobby   = new Lobby(io);

io.on
(
    'connection', 
    (socket) => 
    {
        let newUser = new user.User(socket, `user${userTag++}`, lobby);
        lobby.addUser(newUser);
    }
);

console.log("Listening on port 3000...");
http.listen(3000);
