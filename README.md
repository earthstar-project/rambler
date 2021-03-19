# Triplex

A hyperlinked spatial document browser and authoring environment.

## SaM's PlAnS

- Implement a board component
  - Places linked docs using a `PLACES` edge
  - Sizes linked docs using a `SIZED` edge
  - Is infinitely scrollable
    - Should start with a fixed size
    - Grows and shrinks as you scroll empty space
    - Dimensions ultimately depend on scroll pos + docs
