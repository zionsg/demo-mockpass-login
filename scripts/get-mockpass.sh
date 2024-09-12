#!/bin/sh

##
# Clone MockPass repository from GitHub and create package-lock.json needed for building its Docker image
#
# @example Run from root of this repo: scripts/get-mockpass.sh
##

# Check if in correct directory
if [ ! -d "scripts" ]; then
    echo "Please run this script from root of this repository."
    exit 1
fi

if [ ! -f "tmp/mockpass/package-lock.json" ]; then
    mkdir -p tmp
    cd tmp
    git clone git@github.com:opengovsg/mockpass.git
    cd mockpass
    npm install
    cd ../../
fi

echo "MockPass repository cloned with package-lock.json created."
