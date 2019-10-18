# Create a PR from head to base

Intended to uses solely to merge a given HEAD branch into a given BASE branch.  This is typically used when you may have a `release` branch and a `dev` or `master` branch for active development.

Below is an example configuration:

```yaml
name: Release to Dev

on:
  push:
    branches:
      - release

jobs:
  build:
    runs-on: ubuntu-latest    
    steps:
    - uses: rgmills/pull-request-head-to-base@v0.3.2
      with:
        GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'
        BASE_BRANCH: 'master'
        HEAD_BRANCH: 'release'
```

If you track releases in their own branches such as `release/3.2` then you can omit `HEAD_BRANCH` and the branch that triggered the event will be used.

```yaml
name: Release to Dev

on:
  push:
    branches:
      - release/*

jobs:
  build:
    runs-on: ubuntu-latest    
    steps:
    - uses: rgmills/pull-request-head-to-base@v0.3.2
      with:
        GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'
        BASE_BRANCH: 'master'
```

