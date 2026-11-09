---
title: Orbit
client: Helium
summary: A private app store for the Mac apps, web apps and Claude Code skills a team builds for itself. Ship in an afternoon and install in one click.
lede: Teams are building small internal tools faster than ever. Orbit gives those tools somewhere to live, with a storefront, review, releases and updates, so they don't stay stuck on one laptop.
template: product
disciplines: [Product, Brand]
year: "2026"
role: Product design and engineering
services: [Product strategy, Mac app UI, Identity, Developer tooling]
stack: [Swift, SwiftUI, Hono, Postgres, Cloudflare]
order: 3
featured: true
theme:
  bg: "#120a1c"
  ink: "#f6effc"
  accent: "#ff6a9a"
cover: ../../assets/cases/orbit/launch.jpg
coverAlt: The Orbit launch window floating over a pink and violet macOS desktop
palette:
  - { name: Flare, hex: "#FF6A9A" }
  - { name: Nebula, hex: "#8E3FD1" }
  - { name: Globe Blue, hex: "#4C8DF0" }
  - { name: Void, hex: "#120A1C" }
features:
  - { title: "One storefront", body: "Mac apps, web apps, skills, prompts and MCP connectors all show up in one place and install in one click." }
  - { title: "Release review", body: "Builds are submitted and an admin approves them in the app before anyone receives an update." }
  - { title: "Agent-ready", body: "An MCP server lets an AI agent scaffold, preview and package an app without leaving the editor." }
  - { title: "Shared data", body: "Apps declare their objects in a manifest and get typed, permissioned storage for free." }
gallery:
  - { src: ../../assets/cases/orbit/builder.jpg, alt: "Orbit's What's New Builder app showing a list of draft releases", caption: "What's New Builder, one of the first apps shipped through Orbit.", size: full }
  - { src: ../../assets/cases/orbit/store.jpg, alt: "Orbit store window with a dark globe illustration", size: wide }
  - { src: ../../assets/cases/orbit/desktop.jpg, alt: "Orbit launch splash on the desktop", size: half }
  - { src: ../../assets/cases/orbit/icon.png, alt: "Orbit app icon", size: half }
---

## Why build it

AI changed how quickly a team can make its own tools. A release dashboard or a quarterly-goals tracker now takes an afternoon, but sharing it still meant a zip file in Slack and a security warning on every Mac. Orbit is the missing distribution layer.

## The app

It's a native Mac app with a storefront you'd recognize, plus the pieces that internal tools usually lack: release notes, approvals, permissions and quiet auto-updates. The globe mark and the warm nebula gradients make it feel like a place, not an admin panel.

## For builders

Most Orbit apps are written with an AI agent in the loop. The platform has its own MCP server so an agent can read the docs, check a manifest, generate types, spin up a preview link and submit a release. A human approves the release in Orbit before anyone gets the update.
