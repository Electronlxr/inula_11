#!/bin/bash
#
# Copyright (c) 2020 Huawei Technologies Co.,Ltd.
#
# openGauss is licensed under Mulan PSL v2.
# You can use this software according to the terms and conditions of the Mulan PSL v2.
# You may obtain a copy of Mulan PSL v2 at:
#
#          http://license.coscl.org.cn/MulanPSL2
#
# THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
# EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
# MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
# See the Mulan PSL v2 for more details.
#
if [ -n "${releaseVersion}" ] ; then
  echo "==== Horizon Upgrade ${releaseVersion} ===="
  cd ./build/horizon ||  { echo 'ERROR: Build directory not found' ; exit 1; }

  cd umd
  # umd生产包多暴露全局名HorizonDOM
  # 以解决webpack的externals react-dom和react都指向Horizon时,webpack随机使用key名造成源码交付问题
  sed -i '$a window.HorizonDOM = window.Horizon;' horizon.production.min.js
  cd -

  # 写入新版本号
  npm version "${releaseVersion}"
  cat >.npmrc <<- EndOfMessage
registry=https://cmc.centralrepo.rnd.huawei.com/npm
@cloudsop:registry=https://cmc.centralrepo.rnd.huawei.com/artifactory/api/npm/product_npm
_auth = Y2xvdWRzb3BhcnRpZmFjdG9yeTpDbG91ZHNvcDY2NiEhIQ
always-auth = true
email = cloudsop@huawei.com
EndOfMessage

  echo "==== Publish new version===="

  npm publish
  npm view @cloudsop/horizon@"${releaseVersion}"
else
  echo "No release version, quit."
fi
