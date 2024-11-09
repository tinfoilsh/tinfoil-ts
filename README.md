# Tinfoil Analytics Client

A privacy-preserving web analytics solution using the Distributed Aggregation Protocol (DAP). Collects anonymous metrics while ensuring user privacy through secure aggregation.

## Quick Start

Add the script tag to your HTML:

```html
<script async src="https://js.tinfoil.sh" data-param="your.domain.com"></script>
```

For custom event tracking, add the `tinfoil-event-name` class:

```html
<button class="tinfoil-event-name=Button+Click">Click Me</button>
```

## Development

To run the project locally, use the following commands:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run unit tests
npm run test

# Run end-to-end tests
npm run test:e2e
```

## Publishing

1. Bump the version in `package.json`:

```json
"version": "0.0.XX"
```

2. Build the package:

```bash
npm run build
```

3. Publish the package:

```bash
npm publish
```

4. Go to the [jsdelivr repo](https://github.com/tinfoilanalytics/jsdelivr) and follow the README there to update the hosted version at js.tinfoil.sh.