# prime-cli
The starting point for the command line interface to the next version of Tessel

## Installation
Clone this repo and then run `npm link --local`. 

## Setup
Copy the example.env into a file called config.env and modify each of the fields so that they are accurate. The keyPath refers to the path to your SSH key and the keyPassphrase is an optional configuration if you need to specify a passphrase to access your key.

## Usage
`prime run FILENAME` will deploy that starting file and its dependencies to your remote Tessel
