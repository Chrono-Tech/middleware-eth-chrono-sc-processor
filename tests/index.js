require('dotenv/config');

const config = require('../config'),
  mongoose = require('mongoose'),
  Promise = require('bluebird');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const expect = require('chai').expect,
  awaitLastBlock = require('./helpers/awaitLastBlock'),
  saveAccountForAddress = require('./helpers/saveAccountForAddress'),
  clearQueues = require('./helpers/clearQueues'),
  connectToQueue = require('./helpers/connectToQueue'),
  consumeMessagesUntil = require('./helpers/consumeMessagesUntil'),
  loadContracts = require('./helpers/loadContracts'),
  executeAddCBE = require('./helpers/executeAddCBE'),
  bytes32 = require('./helpers/bytes32'),
  net = require('net'),
  require_all = require('require-all'),
  contract = require('truffle-contract'),
  _ = require('lodash'),
  Web3 = require('web3'),
  web3 = new Web3(),
  amqp = require('amqplib');

let accounts, amqpInstance, ctx;

describe('core/sc processor', function () {

  before(async () => {
    amqpInstance = await amqp.connect(config.rabbit.url);
    await clearQueues(amqpInstance);

    const provider = new Web3.providers.IpcProvider(config.web3.uri, net);
    web3.setProvider(provider);

    ctx = await loadContracts(web3, provider);

    accounts = await Promise.promisify(web3.eth.getAccounts)();
    await saveAccountForAddress(accounts[0]);

    return await awaitLastBlock(web3);
  });

  after(() => {
    web3.currentProvider.connection.end();
    return mongoose.disconnect();
  });

  afterEach(async () => {
    await clearQueues(amqpInstance);
  });

  it('execute twoCBE and validate event in mongo and structure', async () => {
      const prevTx = await executeAddCBE(accounts[0], accounts[1], ctx.contracts);
      const prevHash = prevTx.logs[0].transactionHash;

      const smartTx = await executeAddCBE(accounts[0], accounts[1], ctx.contracts);
      await Promise.delay(10000);
      await Promise.mapSeries(smartTx.logs, async(log) => {
        const controlIndexHash =  `${log.logIndex}:${prevHash}:${web3.sha3(config.web3.network)}`;        
        const mongoDoc = await ctx.smEvents.eventModels[log.event].findOne({
          controlIndexHash
        });
        expect(mongoDoc).to.not.be.null;
        expect(mongoDoc).to.be.an('object');
        expect(mongoDoc.toObject()).to.contain.all.keys(_.merge(
            _.keys(log.args), [
              'network', 'created', 'controlIndexHash', '_id', '__v',
            ]
        )); 
      });
      
  });

  it('execute twoCBE and validate event in mongo and structure', async () => {

    const checkPayload = (payload, log) => {
      expect(payload).to.not.be.null;
      expect(payload).to.be.an('object');
      expect(payload).to.contain.all.keys([
            'network', 'created', 'self'
      ]);

      expect(payload).to.contain.all.keys(_.keys(log.args));
    }

    let smartTx, log;

    await Promise.all([
      (async() => {
        smartTx = await executeAddCBE(accounts[0], accounts[1], ctx.contracts);
        log = smartTx.logs[0];
      })(),
      (async () => {
        const channel = await amqpInstance.createChannel();
        await connectToQueue(channel);
        await consumeMessagesUntil(channel, async(message, res) => {
            data = JSON.parse(message.content);
            if (data.name === log.event)  {
              checkPayload(data.payload, log);
              res();
            }
        });
      })()
    ]);


});



});
