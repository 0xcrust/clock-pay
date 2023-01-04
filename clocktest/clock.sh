#!/usr/bin/bash

function start() {
  rm -r test-ledger
  clockwork localnet --bpf-program $HOME/source/projects/clockpay/clock_anchor/target/deploy/auto-keypair.json $HOME/source/projects/clockpay/clock_anchor/target/deploy/auto.so
}

start
while [ "$?" -ne 0 ]
do 
  clear
  start
done
