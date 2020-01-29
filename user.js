const trivia = require('./trivia-room');

// The list of connected users.
let allUsers = [];
let io       = null;

/* 
    Initialize the User Module.
*/
function init(ioInstance)
{
    io = ioInstance;
}

/*
    A User who is playing a trivia game.
*/
class User {
    /*            
        | socket   | The user's socket; used to communicate with the user.                           |
        | nickname | The name by which the user is known to other players.                           |
        | lobby    | An instance of the lobby to which this user should go when leaving a game room. |
    */
    constructor(socket, nickname, lobby) 
    {
        // The answer this user selected. If -1,
        // it means they haven't selected an answer yet.
        this.answerIndex = -1;
        this.socket      = socket;
        this.nickname    = nickname;
        this.lobby       = lobby;
        this.room        = null;

        // Initialize this user's socket events.
        initializeUser(this);
    }

    hasSelectedAnswer()     { return this.answerIndex != -1;         }
    selectAnswer(answerNum) { this.answerIndex         = answerNum;  }
    unselectAnswer()        { this.answerIndex         = -1;         }

    // Assign the user to the given room, and set
    // the user's socket to talk to that room.
    // If the given room is null, the user is
    // considered roomless.
    setRoom(room)
    {
        // Don't do anything if the user is being set
        // to the room its already in.
        if (this.room === room) return;

        // Remove the socket from the current room, if any.
        if (this.room)
            this.socket.leave(this.room.id);
    
        this.room = room;

        // If this user isn't being set to roomless, set the
        // socket to the new room.
        if (room)
            this.socket.join(room.id);
    }

    // Make the user roomless.
    leaveRoom()
    {
        this.setRoom(null);
    }
}

// Initialize a user's socket events.
function initializeUser(user) 
{
    // Called when the user selects an answer.
    user.socket.on
    (
        'answer', (answerNumber) => 
        {
            if (!user.hasSelectedAnswer()) 
            {
                user.selectAnswer(answerNumber);
                console.log(`${user.nickname} selected answer ${answerNumber}.`);
            }
        }
    );

    // Remove the user from the user list when they disconnect.
    user.socket.on
    (
        'disconnect', () =>
        {
            console.log(`${user.nickname} disconnected.`);
            allUsers.splice(allUsers.findIndex((u) => user === u), 1);

            // Remove the user from the room they are currently in.
            user.room.removeUser(user);
        }
    );

    // Add the user to the given room if it exists.
    user.socket.on
    (
        'join room', (id) =>
        {
            console.log(`${user.nickname} requested to join room ${id}`);
            let room = trivia.getRoomById(id);
            if (room)
            {
                room.addUser(user);
            }
        }
    );

    // Remove the user from the given room, taking them back to the lobby.
    user.socket.on
    (
        'leave room', () =>
        {
            console.log(`${user.nickname} wants to leave room ${user.room.id}`);
            user.lobby.addUser(user);
        }
    );

    // Create a new room and add the user to it.
    user.socket.on
    (
        'create room', () =>
        {
            console.log(`${user.nickname} is creating a new room.`);
            let newRoom = trivia.makeNewRoom(io);
            newRoom.addUser(user);
        }
    );
}

module.exports.User     = User;
module.exports.allUsers = allUsers;
module.exports.init     = init;