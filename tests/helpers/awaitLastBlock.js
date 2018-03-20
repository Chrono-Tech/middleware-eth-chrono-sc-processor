const blockModel = require('../../models/blockModel'),
  config = require('../../config'),
  Promise = require('bluebird');

module.exports = (web3) =>
  new Promise(res => {
    let check = async () => {
      let latestBlock = await Promise.promisify(web3.eth.getBlockNumber)();
      await Promise.delay(10000);
      let currentBlock = (await blockModel.find({network: config.web3.network}).sort('-number').limit(1))[0];
      (currentBlock ? currentBlock.toObject().number : 0) > latestBlock - 10 ?
        res() : check();
    };
    check();
  });
