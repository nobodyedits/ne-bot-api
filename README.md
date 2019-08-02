# Nobody Edits Bot API

[![npm](https://img.shields.io/npm/v/ne-bot-api)](https://www.npmjs.com/package/ne-bot-api)
![GitHub](https://img.shields.io/github/license/nobodyedits/ne-bot-api)

Requires Node.js 12.0+

Early alpha. Hopefully no API breaks...
Not every functionality is implemented right now.
Cool idea for future: hook events such as activating keys and let the bot completely control those actions.

Documentation still TODO. Feel free to open a PR.
You can check the available methods by reading the code right now.
Be sure to check out the [example](https://github.com/nobodyedits/bot-example), it shows most of the functionality.

Beware, there are probably bugs.
Physics are not being processed right now.

**Important**: Never use hardcoded IDs for backgrounds & foregrounds etc., they might change in the future.

## Events

Events will fire before the change is applied to the objects if appropriate.
This enables reading both new and old state.

| Event name                         | Arguments                          | Description                                                                        |
| -----------------                  | ---------------------------------- | ---------------------------------------------------------------------------------- |
| bot:kick                           | message                            | Your bot got kicked by the server. Can happen for example by deleting the API key. |
| bot:disconnect                     |                                    | Your bot got disconnected from the server.                                         |
| player:coin:gold\|blue:got\|lost     | player, new coin count             | A player got/lost a gold/blue coin.                                                |
| player:chat                        | player, message                    | A player sends a chat message.                                                     |
| player:die                         | player                             | A player died.                                                                     |
| player:joined                      | player                             | A player joined the room.                                                          |
| player:jump                        | player                             | A player jumps.                                                                    |
| player:​key:activate                | player, which key                  | A player activated a key. Example key parameter: "red key".                        |
| player:left                        | player                             | A player left the room.                                                            |
| player:move                        | x, y, x dir, y dir, x spd, y spd   | A player updated the moe state.                                                    |
| player:togglegod                   | player                             | A player enabled/disabled god mode.                                                |
| player:tp:toplayer                 | player, destination player         | A player got teleported to another player.                                         |
| player:reset                       | player, x, y                       | A player got reset and teleported to (x, y) (pixel coordinates).                   |
| player:respawn                     | player, x, y                       | A player respawned at (x, y) (pixel coordinates).                                  |
| room:bg                            | player, x, y, bg object            | A player placed a background block at (x, y) (tile coordinates).                   |
| room:fg                            | player, x, y, fg object            | A player placed a foreground block at (x, y) (tile coordinates).                   |
| room:data                          | player, x, y, data                 | A player changed data of block at (x, y) (tile coordinates).                       |
| room:goldcrown                     | player                             | The gold crown changed owner. Player may be null if no one owns the gold crown.    |
| room:name                          | new name                           | The room name was changed.                                                         |
| room:code                          | new code                           | The room code was changed.                                                         |
| room:category                      | new category                       | The room category was changed.                                                     |
| room:visible                       | new lobby visibility value         | The room lobby visibility was changed.                                             |
| room:autoSave                      | new auto-save setting              | The room auto-save setting was changed.                                            |
| room:allowSpectate                 | new allow spectate setting         | The room allow spectate setting was changed.                                       |
| room:allowParticleActions          | new allow particle actions setting | The room allow particle actions setting was changed.                               |
| room:plays                         | plays                              | The amount of plays of the room got updated.                                       |
| room:​key:deactivate                | which key                          | A key got deactivated.                                                             |
| room:reset                         |                                    | The room has been reset.                                                           |
| room:load                          |                                    | The room has been reloaded from save.                                              |
| room:save                          | autosaved                          | The room was saved. The argument is true if the save was triggered by autosave.    |
| system:chat                        | message                            | The system sends a chat message.                                                   |

## Questions

### Why JS and no other language?! >:(

Because NE is completely JS so it fit well. It's also easy to pick up.
Feel free to write a port to another language.

### Why no docs?

No time. Atm the code is the documentation. Feel free to write some docs and create a PR.
