# Live guide

Arrows over the webcam picture and checking each move (PLAN.md section 8).

The user holds the cube the normal way (front toward themselves), so the webcam sees the **back** side.

- `camera-view.ts`: which stickers the camera sees, and the arrow to draw for a step. That's a straight arrow for a row or column sliding across the visible side, or a round arrow when the side facing the camera (or, dashed, the side facing the user) turns.
- `checker.ts`: once the picture is steady, compares it with every way the cube could look. Before the move means wait; after it (or 1-2 moves further) means move on; after a different single turn means "wrong", with the undo. It learns the room light from the visible middle sticker. Moves the camera can't see (turning the side facing the user) are trusted once the hands have moved.

The page is `src/pages/LivePage.tsx`. Browser tests use a fake webcam (a drawn canvas) to check that it follows moves, including one the camera can't see.

**Built in:** Phase 6 (done)
