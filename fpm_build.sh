#!/bin/bash

fpm -s dir -t rpm -n GGUS-Avail-tool -v 0.2 \
  -d nodejs -d httpd -d npm --after-install postinstall.sh \
  app.js=/usr/share/ggus-avail/ \
  config.json=/usr/share/ggus-avail/ \
  public=/usr/share/ggus-avail/ \
  package.json=/usr/share/ggus-avail/ \
  ggus-avail.service=/etc/systemd/system/ \
  ggus-avail-proxy.conf.example=/etc/httpd/conf.d/
