# Triplex

A hyperlinked spatial document browser and authoring environment.

## SaM's PlAnS

- Clean up things a bit!!!

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
- Renders image nodes
  - Make it so that you can tile an image too
- ~~Add a 'status bar' (like when you hover over a URL) which shows who authored a doc, when, and where when hovering over a placed doc.~~
- Implement a way to create or add existing documents to the board
  - make a cute little file browser to navigate workspace docs for adding
  - make a little bucket of edges with unplaced docs
  - give react-earthstar a utility to read earthstar URLs
    - use this so that this app can create and edit documents using other earthstar apps
- Renders midi nodes
- Renders coloured boxes
