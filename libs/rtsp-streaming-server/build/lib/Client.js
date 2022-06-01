"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Client = void 0;

var _dgram = require("dgram");

var _uuid = require("uuid");

var _utils = require("./utils");

const debug = (0, _utils.getDebugger)('Client');
const clientPortRegex = /(?:client_port=)(\d*)-(\d*)/;

class Client {
  constructor(mount, req) {
    this.open = true;
    this.id = (0, _uuid.v4)();
    const info = (0, _utils.getMountInfo)(req.uri);
    this.mount = mount;

    if (this.mount.path !== info.path) {
      throw new Error('Mount does not equal request provided');
    }

    this.stream = this.mount.streams[info.streamId];

    if (!req.socket.remoteAddress || !req.headers.transport) {
      throw new Error('No remote address found or transport header doesn\'t exist');
    }

    const portMatch = req.headers.transport.match(clientPortRegex);
    this.remoteAddress = req.socket.remoteAddress.replace('::ffff:', ''); // Strip IPv6 thing out

    if (!portMatch) {
      throw new Error('Unable to find client ports in transport header');
    }

    this.remoteRtpPort = parseInt(portMatch[1], 10);
    this.remoteRtcpPort = parseInt(portMatch[2], 10);
    this.setupServerPorts();
    this.rtpServer = (0, _dgram.createSocket)('udp4');
    this.rtcpServer = (0, _dgram.createSocket)('udp4');
  }
  /**
   *
   * @param req
   */


  async setup(req) {
    let portError = false;

    try {
      await this.listen();
    } catch (e) {
      // One or two of the ports was in use, cycle them out and try another
      if (e.errno && e.errno === 'EADDRINUSE') {
        console.warn(`Port error on ${e.port}, for stream ${this.stream.id} using another port`);
        portError = true;

        try {
          await this.rtpServer.close();
          await this.rtcpServer.close();
        } catch (e) {
          // Ignore, dont care if couldnt close
          console.warn(e);
        }

        if (this.rtpServerPort) {
          this.mount.mounts.returnRtpPortToPool(this.rtpServerPort);
        }

        this.setupServerPorts();
      } else {
        throw e;
      }
    }

    if (portError) {
      return this.setup(req);
    }

    debug('%s:%s Client set up for path %s, local ports (%s:%s) remote ports (%s:%s)', req.socket.remoteAddress, req.socket.remotePort, this.stream.mount.path, this.rtpServerPort, this.rtcpServerPort, this.remoteRtpPort, this.remoteRtcpPort);
  }
  /**
   *
   */


  play() {
    this.stream.clients[this.id] = this;
  }
  /**
   *
   */


  async close() {
    this.open = false;
    this.mount.clientLeave(this);
    return new Promise(resolve => {
      // Sometimes closing can throw if the dgram has already gone away. Just ignore it.
      try {
        this.rtpServer.close();
      } catch (e) {
        debug('Error closing rtpServer for client %o', e);
      }

      try {
        this.rtcpServer.close();
      } catch (e) {
        debug('Error closing rtcpServer for client %o', e);
      }

      if (this.rtpServerPort) {
        this.mount.mounts.returnRtpPortToPool(this.rtpServerPort);
      }

      return resolve();
    });
  }
  /**
   *
   * @param buf
   */


  sendRtp(buf) {
    if (this.open === true) {
      this.rtpServer.send(buf, this.remoteRtpPort, this.remoteAddress);
    }
  }
  /**
   *
   * @param buf
   */


  sendRtcp(buf) {
    if (this.open === true) {
      this.rtcpServer.send(buf, this.remoteRtcpPort, this.remoteAddress);
    }
  }
  /**
   *
   */


  async listen() {
    return new Promise((resolve, reject) => {
      function onError(err) {
        return reject(err);
      }

      this.rtpServer.on('error', onError);
      this.rtpServer.bind(this.rtpServerPort, () => {
        this.rtpServer.removeListener('error', onError);
        this.rtcpServer.on('error', onError);
        this.rtcpServer.bind(this.rtcpServerPort, () => {
          this.rtcpServer.removeListener('error', onError);
          return resolve();
        });
      });
    });
  }

  setupServerPorts() {
    const rtpServerPort = this.mount.mounts.getNextRtpPort();

    if (!rtpServerPort) {
      throw new Error('Unable to get next RTP Server Port');
    }

    this.rtpServerPort = rtpServerPort;
    this.rtcpServerPort = this.rtpServerPort + 1;
  }

}

exports.Client = Client;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvQ2xpZW50LnRzIl0sIm5hbWVzIjpbImRlYnVnIiwiY2xpZW50UG9ydFJlZ2V4IiwiQ2xpZW50IiwiY29uc3RydWN0b3IiLCJtb3VudCIsInJlcSIsIm9wZW4iLCJpZCIsImluZm8iLCJ1cmkiLCJwYXRoIiwiRXJyb3IiLCJzdHJlYW0iLCJzdHJlYW1zIiwic3RyZWFtSWQiLCJzb2NrZXQiLCJyZW1vdGVBZGRyZXNzIiwiaGVhZGVycyIsInRyYW5zcG9ydCIsInBvcnRNYXRjaCIsIm1hdGNoIiwicmVwbGFjZSIsInJlbW90ZVJ0cFBvcnQiLCJwYXJzZUludCIsInJlbW90ZVJ0Y3BQb3J0Iiwic2V0dXBTZXJ2ZXJQb3J0cyIsInJ0cFNlcnZlciIsInJ0Y3BTZXJ2ZXIiLCJzZXR1cCIsInBvcnRFcnJvciIsImxpc3RlbiIsImUiLCJlcnJubyIsImNvbnNvbGUiLCJ3YXJuIiwicG9ydCIsImNsb3NlIiwicnRwU2VydmVyUG9ydCIsIm1vdW50cyIsInJldHVyblJ0cFBvcnRUb1Bvb2wiLCJyZW1vdGVQb3J0IiwicnRjcFNlcnZlclBvcnQiLCJwbGF5IiwiY2xpZW50cyIsImNsaWVudExlYXZlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZW5kUnRwIiwiYnVmIiwic2VuZCIsInNlbmRSdGNwIiwicmVqZWN0Iiwib25FcnJvciIsImVyciIsIm9uIiwiYmluZCIsInJlbW92ZUxpc3RlbmVyIiwiZ2V0TmV4dFJ0cFBvcnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFFQTs7QUFHQTs7QUFFQSxNQUFNQSxLQUFLLEdBQUcsd0JBQVksUUFBWixDQUFkO0FBRUEsTUFBTUMsZUFBZSxHQUFHLDZCQUF4Qjs7QUFFTyxNQUFNQyxNQUFOLENBQWE7QUFlbEJDLEVBQUFBLFdBQVcsQ0FBRUMsS0FBRixFQUFnQkMsR0FBaEIsRUFBa0M7QUFDM0MsU0FBS0MsSUFBTCxHQUFZLElBQVo7QUFFQSxTQUFLQyxFQUFMLEdBQVUsZUFBVjtBQUNBLFVBQU1D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QUFxQixDQUEzQztBQUNEOztBQS9LaUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVTb2NrZXQsIFNvY2tldCB9IGZyb20gJ2RncmFtJztcbmltcG9ydCB7IFJ0c3BSZXF1ZXN0IH0gZnJvbSAncnRzcC1zZXJ2ZXInO1xuaW1wb3J0IHsgdjQgYXMgdXVpZCB9IGZyb20gJ3V1aWQnO1xuXG5pbXBvcnQgeyBNb3VudCwgUnRzcFN0cmVhbSB9IGZyb20gJy4vTW91bnQnO1xuaW1wb3J0IHsgZ2V0RGVidWdnZXIsIGdldE1vdW50SW5mbyB9IGZyb20gJy4vdXRpbHMnO1xuXG5jb25zdCBkZWJ1ZyA9IGdldERlYnVnZ2VyKCdDbGllbnQnKTtcblxuY29uc3QgY2xpZW50UG9ydFJlZ2V4ID0gLyg/OmNsaWVudF9wb3J0PSkoXFxkKiktKFxcZCopLztcblxuZXhwb3J0IGNsYXNzIENsaWVudCB7XG4gIG9wZW46IGJvb2xlYW47XG4gIGlkOiBzdHJpbmc7XG4gIG1vdW50OiBNb3VudDtcbiAgc3RyZWFtOiBSdHNwU3RyZWFtO1xuXG4gIHJlbW90ZUFkZHJlc3M6IHN0cmluZztcbiAgcmVtb3RlUnRjcFBvcnQ6IG51bWJlcjtcbiAgcmVtb3RlUnRwUG9ydDogbnVtYmVyO1xuXG4gIHJ0cFNlcnZlcjogU29ja2V0O1xuICBydGNwU2VydmVyOiBTb2NrZXQ7XG4gIHJ0cFNlcnZlclBvcnQ/OiBudW1iZXI7XG4gIHJ0Y3BTZXJ2ZXJQb3J0PzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yIChtb3VudDogTW91bnQsIHJlcTogUnRzcFJlcXVlc3QpIHtcbiAgICB0aGlzLm9wZW4gPSB0cnVlO1xuXG4gICAgdGhpcy5pZCA9IHV1aWQoKTtcbiAgICBjb25zdCBpbmZvID0gZ2V0TW91bnRJbmZvKHJlcS51cmkpO1xuICAgIHRoaXMubW91bnQgPSBtb3VudDtcblxuICAgIGlmICh0aGlzLm1vdW50LnBhdGggIT09IGluZm8ucGF0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb3VudCBkb2VzIG5vdCBlcXVhbCByZXF1ZXN0IHByb3ZpZGVkJyk7XG4gICAgfVxuXG4gICAgdGhpcy5zdHJlYW0gPSB0aGlzLm1vdW50LnN0cmVhbXNbaW5mby5zdHJlYW1JZF07XG5cbiAgICBpZiAoIXJlcS5zb2NrZXQucmVtb3RlQWRkcmVzcyB8fCAhcmVxLmhlYWRlcnMudHJhbnNwb3J0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHJlbW90ZSBhZGRyZXNzIGZvdW5kIG9yIHRyYW5zcG9ydCBoZWFkZXIgZG9lc25cXCd0IGV4aXN0Jyk7XG4gICAgfVxuXG4gICAgY29uc3QgcG9ydE1hdGNoOiBSZWdFeHBNYXRjaEFycmF5IHwgbnVsbCA9IHJlcS5oZWFkZXJzLnRyYW5zcG9ydC5tYXRjaChjbGllbnRQb3J0UmVnZXgpO1xuXG4gICAgdGhpcy5yZW1vdGVBZGRyZXNzID0gcmVxLnNvY2tldC5yZW1vdGVBZGRyZXNzLnJlcGxhY2UoJzo6ZmZmZjonLCAnJyk7IC8vIFN0cmlwIElQdjYgdGhpbmcgb3V0XG5cbiAgICBpZiAoIXBvcnRNYXRjaCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZmluZCBjbGllbnQgcG9ydHMgaW4gdHJhbnNwb3J0IGhlYWRlcicpO1xuICAgIH1cblxuICAgIHRoaXMucmVtb3RlUnRwUG9ydCA9IHBhcnNlSW50KHBvcnRNYXRjaFsxXSwgMTApO1xuICAgIHRoaXMucmVtb3RlUnRjcFBvcnQgPSBwYXJzZUludChwb3J0TWF0Y2hbMl0sIDEwKTtcblxuICAgIHRoaXMuc2V0dXBTZXJ2ZXJQb3J0cygpO1xuXG4gICAgdGhpcy5ydHBTZXJ2ZXIgPSBjcmVhdGVTb2NrZXQoJ3VkcDQnKTtcbiAgICB0aGlzLnJ0Y3BTZXJ2ZXIgPSBjcmVhdGVTb2NrZXQoJ3VkcDQnKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gcmVxXG4gICAqL1xuICBhc3luYyBzZXR1cCAocmVxOiBSdHNwUmVxdWVzdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxldCBwb3J0RXJyb3IgPSBmYWxzZTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLmxpc3RlbigpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE9uZSBvciB0d28gb2YgdGhlIHBvcnRzIHdhcyBpbiB1c2UsIGN5Y2xlIHRoZW0gb3V0IGFuZCB0cnkgYW5vdGhlclxuICAgICAgaWYgKGUuZXJybm8gJiYgZS5lcnJubyA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgUG9ydCBlcnJvciBvbiAke2UucG9ydH0sIGZvciBzdHJlYW0gJHt0aGlzLnN0cmVhbS5pZH0gdXNpbmcgYW5vdGhlciBwb3J0YCk7XG4gICAgICAgIHBvcnRFcnJvciA9IHRydWU7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLnJ0cFNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgIGF3YWl0IHRoaXMucnRjcFNlcnZlci5jbG9zZSgpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gSWdub3JlLCBkb250IGNhcmUgaWYgY291bGRudCBjbG9zZVxuICAgICAgICAgIGNvbnNvbGUud2FybihlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJ0cFNlcnZlclBvcnQpIHtcbiAgICAgICAgICB0aGlzLm1vdW50Lm1vdW50cy5yZXR1cm5SdHBQb3J0VG9Qb29sKHRoaXMucnRwU2VydmVyUG9ydCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldHVwU2VydmVyUG9ydHMoKTtcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9ydEVycm9yKSB7XG4gICAgICByZXR1cm4gdGhpcy5zZXR1cChyZXEpO1xuICAgIH1cblxuICAgIGRlYnVnKFxuICAgICAgJyVzOiVzIENsaWVudCBzZXQgdXAgZm9yIHBhdGggJXMsIGxvY2FsIHBvcnRzICglczolcykgcmVtb3RlIHBvcnRzICglczolcyknLFxuICAgICAgcmVxLnNvY2tldC5yZW1vdGVBZGRyZXNzLHJlcS5zb2NrZXQucmVtb3RlUG9ydCxcbiAgICAgIHRoaXMuc3RyZWFtLm1vdW50LnBhdGgsXG4gICAgICB0aGlzLnJ0cFNlcnZlclBvcnQsdGhpcy5ydGNwU2VydmVyUG9ydCxcbiAgICAgIHRoaXMucmVtb3RlUnRwUG9ydCx0aGlzLnJlbW90ZVJ0Y3BQb3J0XG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgcGxheSAoKTogdm9pZCB7XG4gICAgdGhpcy5zdHJlYW0uY2xpZW50c1t0aGlzLmlkXSA9IHRoaXM7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIGNsb3NlICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgICB0aGlzLm1vdW50LmNsaWVudExlYXZlKHRoaXMpO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAvLyBTb21ldGltZXMgY2xvc2luZyBjYW4gdGhyb3cgaWYgdGhlIGRncmFtIGhhcyBhbHJlYWR5IGdvbmUgYXdheS4gSnVzdCBpZ25vcmUgaXQuXG4gICAgICB0cnkgeyB0aGlzLnJ0cFNlcnZlci5jbG9zZSgpOyB9IGNhdGNoIChlKSB7IGRlYnVnKCdFcnJvciBjbG9zaW5nIHJ0cFNlcnZlciBmb3IgY2xpZW50ICVvJywgZSk7IH1cbiAgICAgIHRyeSB7IHRoaXMucnRjcFNlcnZlci5jbG9zZSgpOyB9IGNhdGNoIChlKSB7IGRlYnVnKCdFcnJvciBjbG9zaW5nIHJ0Y3BTZXJ2ZXIgZm9yIGNsaWVudCAlbycsIGUpOyB9XG5cbiAgICAgIGlmICh0aGlzLnJ0cFNlcnZlclBvcnQpIHtcbiAgICAgICAgdGhpcy5tb3VudC5tb3VudHMucmV0dXJuUnRwUG9ydFRvUG9vbCh0aGlzLnJ0cFNlcnZlclBvcnQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSBidWZcbiAgICovXG4gIHNlbmRSdHAgKGJ1ZjogQnVmZmVyKSB7XG4gICAgaWYgKHRoaXMub3BlbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5ydHBTZXJ2ZXIuc2VuZChidWYsIHRoaXMucmVtb3RlUnRwUG9ydCwgdGhpcy5yZW1vdGVBZGRyZXNzKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIGJ1ZlxuICAgKi9cbiAgc2VuZFJ0Y3AgKGJ1ZjogQnVmZmVyKSB7XG4gICAgaWYgKHRoaXMub3BlbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5ydGNwU2VydmVyLnNlbmQoYnVmLCB0aGlzLnJlbW90ZVJ0Y3BQb3J0LCB0aGlzLnJlbW90ZUFkZHJlc3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBsaXN0ZW4gKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBmdW5jdGlvbiBvbkVycm9yIChlcnI6IEVycm9yKSB7XG4gICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5ydHBTZXJ2ZXIub24oJ2Vycm9yJywgb25FcnJvcik7XG5cbiAgICAgIHRoaXMucnRwU2VydmVyLmJpbmQodGhpcy5ydHBTZXJ2ZXJQb3J0LCAoKSA9PiB7XG4gICAgICAgIHRoaXMucnRwU2VydmVyLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uRXJyb3IpO1xuXG4gICAgICAgIHRoaXMucnRjcFNlcnZlci5vbignZXJyb3InLCBvbkVycm9yKTtcbiAgICAgICAgdGhpcy5ydGNwU2VydmVyLmJpbmQodGhpcy5ydGNwU2VydmVyUG9ydCwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucnRjcFNlcnZlci5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbkVycm9yKTtcblxuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHNldHVwU2VydmVyUG9ydHMgKCk6IHZvaWQge1xuICAgIGNvbnN0IHJ0cFNlcnZlclBvcnQgPSB0aGlzLm1vdW50Lm1vdW50cy5nZXROZXh0UnRwUG9ydCgpO1xuICAgIGlmICghcnRwU2VydmVyUG9ydCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gZ2V0IG5leHQgUlRQIFNlcnZlciBQb3J0Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5ydHBTZXJ2ZXJQb3J0ID0gcnRwU2VydmVyUG9ydDtcbiAgICB0aGlzLnJ0Y3BTZXJ2ZXJQb3J0ID0gdGhpcy5ydHBTZXJ2ZXJQb3J0ICsgMTtcbiAgfVxufVxuIl19