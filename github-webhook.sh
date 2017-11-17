#!/bin/bash

echo "Running bash script "$0" with paramaters:" `echo $@`
echo "GITHUB envars set:" `env | awk -F "=" '{print $1}' | grep "GITHUB.*"`

## Usage: github-webhook EVENT
##
## Perform github tasks dependant on webhook EVENT ORIGIN UPSTREAM BRANCH
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
    if [ $# -lt 4 ];
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
    BRANCH="${2}"
    REPO="${3}"
    UPSTREAM="${4}"

    LOCAL_DIR=${REPO##*/}
    
    mkdir "repo-$LOCAL_DIR"
    cd "repo-$LOCAL_DIR"
    
    git clone https://"$GITHUB_OAUTH"@github.com/"$REPO"
    git remote add upstream https://"$GITHUB_OAUTH"@github.com/"$UPSTREAM"
    git fetch upstream
        
    case "$EVENT" in
        addbranch)
            git checkout -b "$BRANCH" upstream/"$BRANCH"
            git push -u origin "$BRANCH"
            git remote rm upstream
            echo "add branch complete"
            exit 0
            break
            ;;

        syncbranch)
            git checkout "$BRANCH"
            git merge upstream/"$BRANCH"
            git push -u origin "$BRANCH"
            git remote rm upstream
            echo "sync branch complete"
            
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