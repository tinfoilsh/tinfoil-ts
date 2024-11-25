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

First, update the version in package.json.

Then, commit the version change and create and push a new tag:

```bash
git add package.json
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z # where X.Y.Z matches the version in package.json
git push origin main --tags
```

This will trigger the GitHub Actions workflow to automatically build and publish the package to `npm`.

Finally, go to the [jsdelivr repo](https://github.com/tinfoilanalytics/jsdelivr) and follow the README there to update the hosted version at js.tinfoil.sh.