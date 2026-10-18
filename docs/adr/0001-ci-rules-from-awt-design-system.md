# CI Rules come from the AWT Design System, not the portal theme or most Example Pages

Pages follow the AWT Design System (brand blue `#2D2D8A`, warm neutrals, Eudoxus Sans, no gradients, Okabe-Ito-based chart colours), with the Mittelverwendung Example Page as its web version. Seven of the eight Example Pages and the data.gr.ch portal theme use a different look (`#0064C8`/`#0069b4` blues, gradient title banners), so generated Pages will deliberately not match them. We chose the department's own design system because it is maintained on purpose and is colourblind-aware, while the older Pages had drifted into three inconsistent styles. When the design system and Mittelverwendung disagree, the design system wins, except for cards, which follow Mittelverwendung (12px radius, soft shadow).

## Consequences

- The older Example Pages remain references for Widget usage and layout, not for styling. Regenerating them, for example as benchmarks, would restyle them.
- The design system was written for slides, so web type sizes come from Mittelverwendung, not from the design system's type scale.
