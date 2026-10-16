# Web UI review — 15 October 2026

These are unchanged browser captures of this release working tree. The filenames
record locale, theme and viewport width. See [provenance](provenance.json) for
source and image hashes. The clean production CSS was checked in all fixture cases.

| Screen           | Evidence                                                | Boundary                      |
| ---------------- | ------------------------------------------------------- | ----------------------------- |
| Homepage         | [English, light, desktop](home-en-light-1440.png)       | Unconfigured production build |
| Login            | [Arabic, dark, phone](login-ar-dark-390.png)            | Invalid test input; no SMS    |
| Signup           | [English, dark, desktop](join-en-dark-1440.png)         | Public role choices           |
| Recycling basket | [English, light, phone](basket-en-light-390.png)        | Labelled synthetic materials  |
| Workspaces       | [English, light, desktop](workspaces-en-light-1440.png) | Labelled synthetic team       |
| Workspaces       | [Arabic, dark, phone](workspaces-ar-dark-390.png)       | Labelled synthetic team       |
| Admin            | [English, light, desktop](admin-home-light-1440.png)    | Labelled synthetic records    |

The isolated fixture matrix passed 48 cases, with 17 captures visually inspected.
Fixture writes are disabled. These images do not prove real authentication,
booking completion or provider execution. Existing Word guides remain historical;
this release does not regenerate them.
