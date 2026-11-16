# Ouru Chess

Play chess locally, create an invite room, or join Quick Match. The site also includes an illustrated tutorial and Stockfish move grades.

## Publish on GitHub Pages

Open **Settings → Pages**. Choose **Deploy from a branch**, select **main** and **/docs**, then click **Save**.

The site and custom apps use the same public matchmaking backend. See the [API documentation](https://chess-api.mmo0216.chatgpt.site/) for endpoints, example code, room invites, and move grading in your own client.

## Run locally

Run `python3 -m http.server 8000 --directory docs` and open `http://localhost:8000`.

Stockfish.js 19.0.1 is distributed under GPLv3. See [the license](docs/engine/LICENSE.txt) and [the corresponding source](https://github.com/nmrugg/stockfish.js/tree/v19.0.1).
