# Earthstar Rambler

A hyperlinked spatial document browser and authoring environment.

## SaM's PlAnS

- Implement a board component
  - ~~Places linked docs using a `PLACES` edge~~
  - ~~Is infinitely scrollable~~
    - ~~Should start with a fixed size~~
    - ~~Grows and shrinks as you scroll empty space~~
    - ~~Dimensions ultimately depend on scroll pos + docs~~
    - ~~Sizes linked docs using a `SIZED` edge~~
    - Can zoom in and out
- ~~Good UI for resizing nodes~~
- Touch events
  - ~~Move canvas on touch~~
  - Pinch to zoom
- ~~Renders text docs~~
  - ~~Editable text docs~~
- ~~Renders image nodes~~
  - ~~Make it so that you can tile an image too~~
- ~~Add a 'status bar' (like when you hover over a URL) which shows who authored a doc, when, and where when hovering over a placed doc.~~
- ~~Implement a way to create or add existing documents to the board~~
  - ~~listen for a touch or click which lasts half a second without moving, using that to modify what happens during drag on canvas...~~
  - ~~after drag ends, pop open a little dialog widget for adding a document~~
    - Existing (doc in workspace), opens a cutesy file browser
      - Have a section for linked but unplaced docs close in proximity to the cursor
    - New (~~text~~, ~~image (triggers upload)~~, coloured box, midi, ~~audio~~)
- give react-earthstar a utility to read earthstar URLs
  - use this so that this app can create and edit documents using other earthstar apps
- text styling
- Rotatable nodes
- ~~Renders audio (mp3/ogg/wav) files~~
  - Render something when there is no ID3 artwork attached to file
  - Fade volume in and out according to viewport proximity
- Renders midi nodes
  - Need to submit a patch to timidity to fix their broken browserify stuff for this
- Renders coloured boxes
- Renders disconnected nodes
  - Probably need this at the selection box level?
  - Lil old school red x box
- A way to control the z-index of nodes
- Normalise file upload names to be earthstar friendly
- A way to delete, not just unlink docs
- Transform author addresses in paths into shortname+identicon for legibility and space
