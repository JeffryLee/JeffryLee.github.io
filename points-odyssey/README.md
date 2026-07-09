# Points Odyssey

A browser-based **Eurogame** about traveling the United States with credit card points.

Earn Chase / Amex / Citi / Bilt points from character-specific spending, apply for cards, transfer into Marriott / Hilton / Hyatt and United / Delta / American, book award flights and free nights, complete Ticket-to-Ride-style trip tickets, weather random events, and chase achievements.

**Players:** 3–6 (hotseat) · **Rounds:** 10 · **Not affiliated** with any bank, hotel, or airline.

## Play locally

From this folder:

```bash
# Python
python3 -m http.server 8080

# or Node
npx --yes serve -l 8080
```

Open **http://localhost:8080**

> ES modules require a local server (opening `index.html` via `file://` will not work).

### Quick start in-game

1. Click characters to add 3–6 players (or **Quick Demo** for 3 random travelers).
2. Each turn: resolve the event → income → up to 2 actions → end turn.
3. After 10 rounds, final scoring crowns the winner.

## Files

| Path | Purpose |
|------|---------|
| `RULES.md` | Full board-game rules & design notes |
| `index.html` | App shell |
| `css/style.css` | UI theme |
| `js/data.js` | Cities, routes, cards, events, achievements |
| `js/game.js` | Game engine |
| `js/ui.js` | Hotseat UI |
| `assets/` | Logo, characters, map, event art |

## Design inspiration (real-world flavor)

Transfer partners are **simplified** for play from publicly documented US ecosystems:

- **Chase Ultimate Rewards** → United, Hyatt, Marriott-style hotel path  
- **Amex Membership Rewards** → Delta, Hilton (inflated 1:2), Marriott  
- **Citi ThankYou** → American-focused path + Hilton  
- **Bilt Rewards** → United + American + Hyatt/Marriott flexibility; rent earn  

US map cities and airline corridors reflect major hubs (ATL, DFW, ORD, DEN, SFO, etc.).

## License

Fan-made educational game. All brand names are trademarks of their owners and used only for thematic reference.
