#!/bin/bash

if [[ $1 == 'off' || $1 == 'debug' ]]; then
  sed -ie 's/xdebug.mode.*/xdebug.mode=$1/g' $PHP_INI_DIR/php.ini
  service apache2 reload
fi
