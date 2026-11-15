# Ouru Chess

Play local two-player chess with illustrated pieces, a beginner’s guide, and Stockfish game review.

## Publish on GitHub Pages

Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/docs**, then click **Save**.

GitHub Pages serves the browser version. Local play, the tutorial, and Stockfish review run in the browser. Quick Match, friend rooms, and Chessigma report submission use the Ouru Chess server and are disabled in the Pages version.

## Run locally

Run `python3 -m http.server 8000 --directory docs` and open `http://localhost:8000`.

Stockfish.js 19.0.1 is distributed under GPLv3. See [the license](docs/engine/LICENSE.txt) and [the corresponding source](https://github.com/nmrugg/stockfish.js/tree/v19.0.1).
