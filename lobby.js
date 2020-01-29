const user     = require('./user');
const trivia   = require('./trivia-room');
const RoomBase = require('./roombase');

class Lobby extends RoomBase
{
    constructor(ioInstance)
    {
        super(ioInstance);
        this.id = 'lobby';

        // When the trivia module creates a new trivia room,
        // alert the lobby.
        trivia.triviaEventEmitter.on
        (
            trivia.events.NEW_ROOM, (room) =>
            {
                this.sendNewRoom(room);
            }
        );

        // When the trivia module deletes a trivia room,
        // alert the lobby.
        trivia.triviaEventEmitter.on
        (
            trivia.events.DELETE_ROOM, (room) =>
            {
                this.sendDeleteRoom(room);
            }
        );
    }

    // Add a user to the lobby, sending them the room list once they join.
    addUser(user)
    {
        super.addUser(user);
        this.sendRoomListToUser(user);
    }

    // Send the room list to the user.
    sendRoomListToUser(user)
    {
        user.socket.emit('room list', trivia.getRoomIdList());
    }

    // Tell the users in the lobby that a new room was created.
    sendNewRoom(room)
    {
        this.io.to(this.id).emit('new room', room.id);
    }

    // Tell the users in the lobby that a room was deleted.
    sendDeleteRoom(room)
    {
        this.io.to(this.id).emit('delete room', room.id);
    }
}

module.exports = Lobby;