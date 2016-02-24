'use strict';

const Peer    = require('../src/peer');
const Socket  = require('../src/socket');
const util    = require('../src/util');

const assert = require('power-assert');
const sinon  = require('sinon');

describe('Peer', () => {
  const apiKey = 'abcdefgh-1234-5678-jklm-zxcvasdfqwrt';
  const timeForAsync = 10;

  describe('Constructor', () => {
    it('should create a Peer object', () => {
      const peer = new Peer({
        key: apiKey
      });
      assert(peer);
      assert(peer instanceof Peer);
    });

    it('should create a Peer object with default options', () => {
      const peer = new Peer({
        key: apiKey
      });
      assert(peer.options.debug === util.LOG_LEVELS.NONE);
      assert(peer.options.host === util.CLOUD_HOST);
      assert(peer.options.port === util.CLOUD_PORT);
      assert(peer.options.token);
      assert(typeof peer.options.token === 'string');
      assert(peer.options.config === util.defaultConfig);
      assert(peer.options.turn === true);
    });

    it('should create a Peer object with options overwritten', () => {
      const config = {iceServers: []};
      const peer = new Peer({
        key:    apiKey,
        debug:  util.LOG_LEVELS.FULL,
        config: config
      });
      // Overwritten
      assert(peer.options.key === apiKey);
      assert(peer.options.debug === util.LOG_LEVELS.FULL);
      assert(peer.options.config === config);

      // Default unchanged
      assert(peer.options.host === util.CLOUD_HOST);
      assert(peer.options.port === util.CLOUD_PORT);
      assert(peer.options.token);
      assert(typeof peer.options.token === 'string');
      assert(peer.options.turn === true);
    });

    // TODO: run after socket is implemented.
    // Can't stub as socket.start is run in constructor
    it.skip('should create a Peer object with ID', done => {
      const peerId = 'myID';
      const peer = new Peer(peerId, {
        key: apiKey
      });

      peer.on('open', id => {
        assert(id === peerId);
        assert(peer.id === peerId);

        done();
      });
    });

    it('should not create a Peer object with invalid ID', done => {
      let peer;
      try {
        peer = new Peer('間違ったIDです', {
          key: apiKey
        });
      } catch (e) {
        assert(peer === undefined);
        done();
      }
    });

    it('should not create a Peer object with invalid API key', done => {
      let peer;
      try {
        peer = new Peer({
          key: 'wrong'
        });
      } catch (e) {
        assert(peer === undefined);
        done();
      }
    });

    it('should contain a Socket object', () => {
      const peer = new Peer({
        key: apiKey
      });

      assert(peer.socket);
      assert(peer.socket instanceof Socket);
    });

    it('should set up socket message listeners', () => {
      const spy = sinon.spy(Socket.prototype, 'on');

      const peer = new Peer({
        key: apiKey
      });

      assert(peer);
      assert(spy.called === true);
      assert(spy.calledWith(util.MESSAGE_TYPES.OPEN.name) === true);
      assert(spy.calledWith(util.MESSAGE_TYPES.ERROR.name) === true);
      assert(spy.calledWith(util.MESSAGE_TYPES.LEAVE.name) === true);
      assert(spy.calledWith(util.MESSAGE_TYPES.EXPIRE.name) === true);
      assert(spy.calledWith(util.MESSAGE_TYPES.OFFER.name) === true);
      spy.restore();
    });

    it('should abort on a socket "error"', done => {
      const peer = new Peer({
        key: apiKey
      });

      const errMsg = 'test error';

      peer.on('error', err => {
        assert(err.type === 'socket-error');
        assert(err.message === errMsg);
        done();
      });

      peer.socket.emit('error', errMsg);
    });

    it('should abort and disconnect on a socket "disconnect" event', done => {
      const peer = new Peer({
        key: apiKey
      });

      const spy = sinon.spy(peer, 'disconnect');

      peer.on('error', err => {
        assert(err.type === 'socket-error');
        assert(err.message === 'Lost connection to server.');

        assert(spy.calledOnce);
        spy.restore();
        done();
      });

      peer.socket.emit('disconnect');
    });

    it('should call destroy onbeforeunload', () => {
      const peer = new Peer({
        key: apiKey
      });

      window.onbeforeunload();
      assert(peer._destroyCalled === true);
    });
  });

  describe('Disconnect', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should emit "disconnected" event on peer', done => {
      peer.disconnect();
      peer.on('disconnected', id => {
        assert(peer.id === id);
        done();
      });
    });

    it('should set _disconnectCalled to true and open to false', done => {
      peer.disconnect();
      peer.on('disconnected', () => {
        assert(peer._disconnectCalled === true);
        assert(peer.open === false);
        done();
      });
    });

    it('should call socket.close', done => {
      const spy = sinon.spy(peer.socket, 'close');

      peer.disconnect();

      peer.on('disconnected', () => {
        assert(spy.calledOnce === true);
        spy.restore();
        done();
      });
    });

    it('should not do anything the second time you call it', function(done) {
      peer.disconnect();

      let disconnectEventCount = 0;
      let beforeTestTimeout = this.timeout - 100;

      setTimeout(() => {
        assert(disconnectEventCount === 1);
        done();
      }, beforeTestTimeout);

      peer.on('disconnected', () => {
        assert(++disconnectEventCount === 1);
        peer.disconnect();
      });
    });

    it('should set _lastPeerId to current id and id to null', done => {
      peer.disconnect();

      peer.on('disconnected', id => {
        setTimeout(() => {
          assert(peer._lastPeerId === id);
          assert(peer.id === null);
          done();
        }, timeForAsync);
      });
    });
  });

  describe('Destroy', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should call disconnect()', () => {
      const spy = sinon.spy(peer, 'disconnect');

      peer.destroy();

      assert(spy.calledOnce === true);

      spy.restore();
    });

    it('should set _destroyCalled to true', done => {
      peer.destroy();

      peer.on('disconnected', () => {
        assert(peer._destroyCalled === true);
        done();
      });
    });

    it('should not call disconnect() the second time you call it', () => {
      const spy = sinon.spy(peer, 'disconnect');

      peer.destroy();
      peer.destroy();

      assert(spy.calledOnce === true);

      spy.restore();
    });

    it('should call _cleanupPeer for each peer in peer.connections', () => {
      const peerIds = [];
      const numPeers = 10;
      for (let peerIndex = 0; peerIndex < numPeers; peerIndex++) {
        const peerId = util.randomToken();
        peerIds.push(peerId);
        peer.connections[peerId] = [];
      }

      const stub = sinon.stub(peer, '_cleanupPeer');
      peer.destroy();

      assert(stub.callCount === peerIds.length);
      for (let peerId of peerIds) {
        assert(stub.calledWith(peerId) === true);
      }

      stub.restore();
    });
  });

  describe('GetConnection', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey
      });
    });

    afterEach(() => {
      peer.disconnect();
    });

    it('should get a connection if peerId and connId match', () => {
      const peerId = 'testId';
      const connection = {id: 'connId'};

      peer._addConnection(peerId, connection);

      assert(peer.getConnection(peerId, connection.id) === connection);
    });

    it('should return null if connection doesn\'t exist', () => {
      const peerId = 'testId';
      const connection = {id: 'connId'};

      assert(peer.getConnection(peerId, connection.id) === null);
    });
  });

  describe('_CleanupPeer', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should call close for each connection in the peer', () => {
      const peerId = util.randomToken();
      peer.connections[peerId] = [];

      const spies = [];
      const numConns = 5;
      for (let connIndex = 0; connIndex < numConns; connIndex++) {
        const spy = sinon.spy();
        spies.push(spy);
        peer.connections[peerId].push({close: spy});
      }

      assert(spies.length === numConns);
      assert(peer.connections[peerId].length === numConns);

      peer._cleanupPeer(peerId);
      for (let spy of spies) {
        assert(spy.calledOnce === true);
      }
    });
  });

  describe('_setupMessageHandlers', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should set peer.id on OPEN events', () => {
      assert(peer.id === undefined);

      const peerId = 'testId';
      peer.socket.emit(util.MESSAGE_TYPES.OPEN.name, peerId);

      assert(peer.id === peerId);
    });

    it('should abort with server-error on ERROR events', () => {
      const errMsg = 'Error message';
      try {
        peer.socket.emit(util.MESSAGE_TYPES.ERROR.name, errMsg);
      } catch (e) {
        assert(e.type === 'server-error');
        assert(e.message === errMsg);

        return;
      }

      assert.fail();
    });

    it('should log a message on LEAVE events', () => {
      const peerId = 'testId';

      const spy = sinon.spy(util, 'log');

      peer.socket.emit(util.MESSAGE_TYPES.LEAVE.name, {src: peerId});

      assert(spy.calledOnce === true);
      assert(spy.calledWith(`Received leave message from ${peerId}`) === true);

      spy.restore();
    });

    it('should emit a peer-unavailable error on EXPIRE events', done => {
      const peerId = 'testId';
      peer.on(Peer.EVENTS.error.name, e => {
        assert(e.type === 'peer-unavailable');
        assert(e.message === `Could not connect to peer ${peerId}`);
        done();
      });

      peer.socket.emit(util.MESSAGE_TYPES.EXPIRE.name, {src: peerId});
    });

    it('should create MediaConnection on media OFFER events', done => {
      const peerId = 'testId';
      peer.on(Peer.EVENTS.call.name, connection => {
        assert(connection);
        assert(connection.constructor.name === 'MediaConnection');
        assert(Object.keys(peer.connections[peerId]).length === 1);
        assert(peer.getConnection(peerId, connection.id) === connection);
        done();
      });

      const offerMsg = {
        type:         'media',
        connectionId: util.randomToken(),
        src:          peerId,
        metadata:     {}
      };
      peer.socket.emit(util.MESSAGE_TYPES.OFFER.name, offerMsg);
    });

    it('should create DataConnection on data OFFER events', done => {
      const peerId = 'testId';
      peer.on(Peer.EVENTS.connection.name, connection => {
        assert(connection);
        assert(connection.constructor.name === 'DataConnection');
        assert(Object.keys(peer.connections[peerId]).length === 1);
        assert(peer.getConnection(peerId, connection.id) === connection);

        done();
      });

      const offerMsg = {
        type:         'data',
        connectionId: util.randomToken(),
        src:          peerId,
        metadata:     {}
      };
      peer.socket.emit(util.MESSAGE_TYPES.OFFER.name, offerMsg);
    });
  });

  describe('ListAllPeers', () => {
    let peer;
    let requests = [];
    let xhr;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey
      });

      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = function(request) {
        requests.push(request);
      };
    });

    afterEach(() => {
      xhr.restore();
      requests = [];

      peer.destroy();
    });

    it('should send a "GET" request to the right URL', () => {
      peer.listAllPeers();
      assert(requests.length === 1);

      const protocol = peer.options.secure ? 'https://' : 'http://';
      const url = `${protocol}${peer.options.host}:` +
        `${peer.options.port}/active/list/${apiKey}`;
      assert(requests[0].url === url);
      assert(requests[0].method === 'get');
    });

    it('should call the callback with the response as the argument', () => {
      const spy = sinon.spy();
      peer.listAllPeers(spy);
      assert(requests.length === 1);

      const peerList = ['peerId1', 'peerId2', 'peerId3'];
      requests[0].respond(200, {}, JSON.stringify(peerList));

      assert(spy.calledOnce === true);
      assert(spy.calledWith(peerList) === true);
    });

    it('should throw an error when the status is 401', () => {
      try {
        peer.listAllPeers();
        requests.respond(401);
      } catch (e) {
        assert(e instanceof Error);
        return;
      }

      assert.fail('Didn\'t throw an error');
    });

    it('should call the callback with an empty array any other status', () => {
      const spy = sinon.spy();
      const peerList = JSON.stringify(['peerId1', 'peerId2', 'peerId3']);
      const responseCodes = [202, 400, 403, 404, 408, 500, 503];

      for (let codeIndex = 0; codeIndex <= responseCodes.length; codeIndex++) {
        peer.listAllPeers(spy);
        requests[codeIndex].respond(responseCodes[codeIndex], {}, peerList);
      }

      assert(spy.withArgs([]).callCount === responseCodes.length);
    });
  });
});