#!/bin/bash

echo "Running bash script "$0" with paramaters:" `echo $@`
echo "GITHUB envars set:" `env | awk -F "=" '{print $1}' | grep "GITHUB.*"`

## Usage: github-webhook EVENT
##
## Perform github tasks dependant on webhook EVENT
##
## Options:
##   -h, --help    Display this message.
##
usage() {
  [ "$*" ] && echo "$0: $*"
  sed -n '/^##/,/^$/s/^## \{0,1\}//p' "$0"
  exit 2
} 2>/dev/null
main() {
    if [ $# -eq 0 ];
        then usage 2>&1
    fi
    while [ $# -gt 0 ]; do
        case $1 in
            (-h|--help) usage 2>&1;;
            (--) break;;
            (-*) usage "$1: unknown option";;
            (*)  break;;
        esac
        shift
    done

    EVENT="${1}"
    
    ## LOCAL=${REPO##*/}
        
    case "$EVENT" in
        push)
            echo $GITHUB_repository
            # | awk -F ":" '{print $2}' | grep "forks_url.*"
            #get forks
            FORK_URL = echo $GITHUB_repository | awk -F ":" '{print $2}' | grep "forks_url.*"
            echo $FORK_URL
            #git clone https://"$GITHUB_OAUTH"@github.com/"$REPO"                
            exit 0
            break
            ;;
            
        *) echo "No tasks set for event '${EVENT}'"
            exit 0
            ;;
    esac
}

set -e          # exit on command errors

main $@ 