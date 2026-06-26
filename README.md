# Botswana Online Safari

A cute multiplayer web app inspired by the board game Botswana / Wildlife Safari.  
This version is prepared for both local LAN play and online deployment through GitHub + Render.

The project uses original UI, emoji-based animal cards, and no official board game artwork.

## Features

- Multiplayer room system for 2-6 players
- Works online after deploy, or locally on LAN
- Host creates a room and shares room link/code
- Real-time play using Socket.IO
- Card hand UI: click a card to play it
- Token selection UI after playing a card
- Cute safari-style responsive UI with light animations
- Round scoring and cumulative scoring
- Mobile-friendly layout
- 6-player house-rule support

## Implemented rules

- There are 5 animal types.
- Each animal has cards numbered 0 to 5.
- On your turn, play one card from your hand to the matching animal row.
- After playing a card, take one available animal token of any type.
- The round ends when any animal row reaches 6 cards, when all tokens are gone, or when all hands are empty.
- At the end of the round, each animal token scores according to the latest card value on that animal row.
- Scores are added to each player's cumulative total.

Note: The commercial game is generally listed for 2-5 players. This app supports a 6-player house-rule mode by using 6 animal tokens per animal type.

## Quick start locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Deploy online

Recommended: GitHub + Render

This package includes `render.yaml`, so Render can deploy it as a Node Web Service.

See Thai step-by-step guide:

`GITHUB_RENDER_DEPLOY_TH.md`

Render settings if you deploy manually:

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## File structure

- `server.js` - Express + Socket.IO server and game logic
- `public/index.html` - main page
- `public/styles.css` - UI styling and animations
- `public/app.js` - browser-side interaction
- `package.json` - Node.js dependencies and scripts
- `render.yaml` - Render deployment config
- `railway.json` - optional Railway deployment config
- `Dockerfile` / `docker-compose.yml` - optional NAS/server deployment
- `GITHUB_RENDER_DEPLOY_TH.md` - Thai deployment guide

## Important production note

Rooms are stored in server memory. If the server restarts, active rooms disappear and players need to create a new room. For casual friend-group play, this is acceptable. For a long-term public game, add persistent storage later.


## UI update
- เพิ่ม turn timer 30 วินาทีที่กึ่งกลางด้านบนเมื่อถึงตาผู้เล่น
- ถ้าผู้เล่นสลับไปแท็บอื่น browser title จะกระพริบเมื่อถึงตาของตัวเอง
- คงรูปแบบไพ่ในมือแบบเดิม และปรับกองไพ่กลาง/คะแนนสดด้านซ้ายให้อ่านง่ายขึ้น


## Latest update

- Round scoreboard modal highlights Top 1-2-3 after each round.
- Seats are shuffled once when the game starts and the left player panel follows that turn order.
- Player cards are compacted to fit 6 players more comfortably.


## Latest UI updates
- Game Log fixed-width kill feed with Bangkok time.
- Card order updates no longer broadcast a full refresh to other players.
- Player cards show only hand count, previous total, current total, and animal tokens.
- Added local face-down / face-up card toggle.


## Latest update notes

- Default game mode uses 5 animal types for up to 5 players.
- When the room has 6 or 7 players, the game automatically adds Rhino as the 6th animal type.
- Player cards show only: hand count, previous total score, current round realtime score, and collected animal tokens.
- Game Log records card placement immediately, then records the selected animal token as a separate feed entry.
- The welcome screen is simplified to player name, room code, Join, Create Room, and animated animal icons.

## Rules/chat/responsive update

- 2-5 players: 5 animal types, cards 0-5.
- 6 players: 6 animal types, cards 0-5.
- 7 players: 6 animal types, cards 0-6.
- Animal tokens remain fixed at 5 tokens per animal type for all player counts.
- The top status bar shows the active rule summary, including player count, animal count, card range, and deck size.
- Round-end scoring uses a server-side round result snapshot so the scoreboard modal opens more reliably.
- Animal token banks highlight when only 1 token remains or when the token is exhausted.
- Selecting an animal triggers a client-side flying animal animation from the board to the player card.
- Added real-time chat above the player's hand.
- Responsive layout adjustments reduce overlap when the browser window is resized.


## Latest UI update
- Player cards now show only hand count and collected animals.
- Realtime ranking train added above the three main panels.
- Safari Board animal order is shuffled each round.
- Chat area shows at least four visible lines.
- Game Log spacing adjusted to prevent overlap.
