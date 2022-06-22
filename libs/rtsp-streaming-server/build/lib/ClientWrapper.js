'use strict'

Object.defineProperty( exports, '__esModule', {
	value: true
} )
exports.ClientWrapper = void 0

var _uuid = require( 'uuid' )

var _Client = require( './Client' )

var _utils = require( './utils' )

const debug = ( 0, _utils.getDebugger )( 'ClientWrapper' )

class ClientWrapper {
	constructor( clientServer, req ) {
		this.id = ( 0, _uuid.v4 )()
		this.clientServer = clientServer
		this.clients = {}
		debug( '%s - constructed', this.id )
		const info = ( 0, _utils.getMountInfo )( req.uri )
		const mount = clientServer.mounts.mounts[info.path]

		if ( !mount ) {
			throw new Error( 'Mount does not exist' )
		}

		this.context = req.context || {}
		this.mount = mount
		this.authorizationHeader = req.headers.authorization || ''
	}
	/**
   *
   * @param mounts
   * @param req
   */


	addClient( req ) {
		const client = new _Client.Client( this.mount, req ) // Some clients for whatever reason don't send RTSP keepalive requests
		// (Live555 streaming media as an example)
		// RTP spec says compliant clients should be sending rtcp Receive Reports (RR) to show their "liveliness"
		// So we support this as a keepalive too.

		client.rtcpServer.on( 'message', () => {
			this.keepalive()
		} )
		this.clients[client.id] = client
		debug( '%s new client %s', this.id, client.id )
		return client
	}
	/**
   *
   */


	play() {
		for ( let client in this.clients ) {
			this.clients[client].play()
		}

		this.keepalive()
	}
	/**
   *
   */


	close() {
		if ( this.keepaliveTimeout ) {
			clearTimeout( this.keepaliveTimeout )
		}

		for ( let client in this.clients ) {
			this.clients[client].close()
		}

		this.clientServer.clientGone( this.id )
	}
	/**
   *
   */


	keepalive() {
		if ( this.keepaliveTimeout ) {
			clearTimeout( this.keepaliveTimeout )
		}

		this.keepaliveTimeout = setTimeout( async () => {
			debug( '%s client timeout, closing connection', this.id )

			try {
				await this.close()
			} catch ( e ) {// Ignore
			}
		}, 6e4 ) // 60 seconds (double the normal keepalive interval)
	}

}

exports.ClientWrapper = ClientWrapper
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvQ2xpZW50V3JhcHBlci50cyJdLCJuYW1lcyI6WyJkZWJ1ZyIsIkNsaWVudFdyYXBwZXIiLCJjb25zdHJ1Y3RvciIsImNsaWVudFNlcnZlciIsInJlcSIsImlkIiwiY2xpZW50cyIsImluZm8iLCJ1cmkiLCJtb3VudCIsIm1vdW50cyIsInBhdGgiLCJFcnJvciIsImNvbnRleHQiLCJhdXRob3JpemF0aW9uSGVhZGVyIiwiaGVhZGVycyIsImF1dGhvcml6YXRpb24iLCJhZGRDbGllbnQiLCJjbGllbnQiLCJDbGllbnQiLCJydGNwU2VydmVyIiwib24iLCJfYnVmIiwia2VlcGFsaXZlIiwicGxheSIsImNsb3NlIiwia2VlcGFsaXZlVGltZW91dCIsImNsZWFyVGltZW91dCIsImNsaWVudEdvbmUiLCJzZXRUaW1lb3V0IiwiZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUNBOztBQUVBOztBQUdBOztBQUVBLE1BQU1BLEtBQUssR0FBRyx3QkFBWSxlQUFaLENBQWQ7O0FBRU8sTUFBTUMsYUFBTixDQUFvQjtBQWN6QkMsRUFBQUEsV0FBVyxDQUFFQyxZQUFGLEVBQThCQyxHQUE5QixFQUFnRDtBQUN6RCxTQUFLQyxFQUFMLEdBQVUsZUFBVjtBQUNBLFNBQUtGLFlBQUwsR0FBb0JBLFlBQXBCO0FBQ0EsU0FBS0csT0FBTCxHQUFlLEVBQWY7QUFDQU4sSUFBQUEsS0FBSyxDQUFDLGtCQUFELEVBQXFCLEtBQUtLLEVBQTFCLENBQUw7QUFFQSxVQUFNRSxJQUFJLEdBQUcseUJBQWFILEdBQUcsQ0FBQ0ksR0FBakIsQ0FBYjtBQUNBLFVBQU1DLEtBQUssR0FBR04sWUFBWSxDQUFDTyxNQUFiLENBQW9CQSxNQUFwQixDQUEyQkgsSUFBSSxDQUFDSSxJQUFoQyxDQUFkOztBQUNBLFFBQUksQ0FBQ0YsS0FBTCxFQUFZO0FBQ1YsWUFBTSxJQUFJRyxLQUFKLENBQVUsc0JBQVYsQ0FBTjtBQUNEOztBQUVELFNBQUtDLE9BQUwsR0FBZ0JULEdBQUQsQ0FBYVMsT0FBYixJQUF3QixFQUF2QztBQUVBLFNBQUtKLEtBQUwsR0FBYUEsS0FBYjtBQUNBLFNBQUtLLG1CQUFMLEdBQTJCVixHQUFHLENBQUNXLE9BQUosQ0FBWUMsYUFBWixJQUE2QixFQUF4RDtBQUNEO0FBRUQ7Ozs7Ozs7QUFLQUMsRUFBQUEsU0FBUyxDQUFFYixHQUFGLEVBQTRCO0FBQ25DLFVBQU1jLE1BQU0sR0FBRyxJQUFJQyxjQUFKLENBQVcsS0FBS1YsS0FBaEIsRUFBdUJMLEdBQXZCLENBQWYsQ0FEbUMsQ0FHbkM7QUFDQTtBQUNBO0FBQ0E7O0FBQ0FjLElBQUFBLE1BQU0sQ0FBQ0UsVUFBUCxDQUFrQkMsRUFBbEIsQ0FBcUIsU0FBckIsRUFBaUNDLElBQUQsSUFBa0I7QUFDaEQsV0FBS0MsU0FBTDtBQUNELEtBRkQ7QUFJQSxTQUFLakIsT0FBTCxDQUFhWSxNQUFNLENBQUNiLEVBQXBCLElBQTBCYSxNQUExQjtBQUNBbEIsSUFBQUEsS0FBSyxDQUFDLGtCQUFELEVBQXFCLEtBQUtLLEVBQTFCLEVBQThCYSxNQUFNLENBQUNiLEVBQXJDLENBQUw7QUFDQSxXQUFPYSxNQUFQO0FBQ0Q7QUFFRDs7Ozs7QUFHQU0sRUFBQUEsSUFBSSxHQUFVO0FBQ1osU0FBSyxJQUFJTixNQUFULElBQW1CLEtBQUtaLE9BQXhCLEVBQWlDO0FBQy9CLFdBQUtBLE9BQUwsQ0FBYVksTUFBYixFQUFxQk0sSUFBckI7QUFDRDs7QUFFRCxTQUFLRCxTQUFMO0FBQ0Q7QUFFRDs7Ozs7QUFHQUUsRUFBQUEsS0FBSyxHQUFVO0FBQ2IsUUFBSSxLQUFLQyxnQkFBVCxFQUEyQjtBQUN6QkMsTUFBQUEsWUFBWSxDQUFDLEtBQUtELGdCQUFOLENBQVo7QUFDRDs7QUFFRCxTQUFLLElBQUlSLE1BQVQsSUFBbUIsS0FBS1osT0FBeEIsRUFBaUM7QUFDL0IsV0FBS0EsT0FBTCxDQUFhWSxNQUFiLEVBQXFCTyxLQUFyQjtBQUNEOztBQUVELFNBQUt0QixZQUFMLENBQWtCeUIsVUFBbEIsQ0FBNkIsS0FBS3ZCLEVBQWxDO0FBQ0Q7QUFFRDs7Ozs7QUFHQWtCLEVBQUFBLFNBQVMsR0FBVTtBQUNqQixRQUFJLEtBQUtHLGdCQUFULEVBQTJCO0FBQ3pCQyxNQUFBQSxZQUFZLENBQUMsS0FBS0QsZ0JBQU4sQ0FBWjtBQUNEOztBQUVELFNBQUtBLGdCQUFMLEdBQXdCRyxVQUFVLENBQUMsWUFBWTtBQUM3QzdCLE1BQUFBLEtBQUssQ0FBQyx1Q0FBRCxFQUEwQyxLQUFLSyxFQUEvQyxDQUFMOztBQUNBLFVBQUk7QUFDRixjQUFNLEtBQUtvQixLQUFMLEVBQU47QUFDRCxPQUZELENBRUUsT0FBT0ssQ0FBUCxFQUFVLENBQ1Y7QUFDRDtBQUNGLEtBUGlDLEVBTy9CLEdBUCtCLENBQWxDLENBTGlCLENBWVI7QUFDVjs7QUEvRndCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUnRzcFJlcXVlc3QgfSBmcm9tICdydHNwLXNlcnZlcic7XG5pbXBvcnQgeyB2NCBhcyB1dWlkIH0gZnJvbSAndXVpZCc7XG5cbmltcG9ydCB7IENsaWVudCB9IGZyb20gJy4vQ2xpZW50JztcbmltcG9ydCB7IENsaWVudFNlcnZlciB9IGZyb20gJy4vQ2xpZW50U2VydmVyJztcbmltcG9ydCB7IE1vdW50IH0gZnJvbSAnLi9Nb3VudCc7XG5pbXBvcnQgeyBnZXREZWJ1Z2dlciwgZ2V0TW91bnRJbmZvIH0gZnJvbSAnLi91dGlscyc7XG5cbmNvbnN0IGRlYnVnID0gZ2V0RGVidWdnZXIoJ0NsaWVudFdyYXBwZXInKTtcblxuZXhwb3J0IGNsYXNzIENsaWVudFdyYXBwZXIge1xuICBpZDogc3RyaW5nO1xuICBtb3VudDogTW91bnQ7XG4gIGNsaWVudFNlcnZlcjogQ2xpZW50U2VydmVyO1xuXG4gIGNsaWVudHM6IHtcbiAgICBbY2xpZW50SWQ6IHN0cmluZ106IENsaWVudDtcbiAgfTtcblxuICBrZWVwYWxpdmVUaW1lb3V0PzogTm9kZUpTLlRpbWVvdXQ7XG4gIGNvbnRleHQ6IGFueTtcblxuICBhdXRob3JpemF0aW9uSGVhZGVyOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IgKGNsaWVudFNlcnZlcjogQ2xpZW50U2VydmVyLCByZXE6IFJ0c3BSZXF1ZXN0KSB7XG4gICAgdGhpcy5pZCA9IHV1aWQoKTtcbiAgICB0aGlzLmNsaWVudFNlcnZlciA9IGNsaWVudFNlcnZlcjtcbiAgICB0aGlzLmNsaWVudHMgPSB7fTtcbiAgICBkZWJ1ZygnJXMgLSBjb25zdHJ1Y3RlZCcsIHRoaXMuaWQpO1xuXG4gICAgY29uc3QgaW5mbyA9IGdldE1vdW50SW5mbyhyZXEudXJpKTtcbiAgICBjb25zdCBtb3VudCA9IGNsaWVudFNlcnZlci5tb3VudHMubW91bnRzW2luZm8ucGF0aF07XG4gICAgaWYgKCFtb3VudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb3VudCBkb2VzIG5vdCBleGlzdCcpO1xuICAgIH1cblxuICAgIHRoaXMuY29udGV4dCA9IChyZXEgYXMgYW55KS5jb250ZXh0IHx8IHt9O1xuXG4gICAgdGhpcy5tb3VudCA9IG1vdW50O1xuICAgIHRoaXMuYXV0aG9yaXphdGlvbkhlYWRlciA9IHJlcS5oZWFkZXJzLmF1dGhvcml6YXRpb24gfHwgJyc7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIG1vdW50c1xuICAgKiBAcGFyYW0gcmVxXG4gICAqL1xuICBhZGRDbGllbnQgKHJlcTogUnRzcFJlcXVlc3QpOiBDbGllbnQge1xuICAgIGNvbnN0IGNsaWVudCA9IG5ldyBDbGllbnQodGhpcy5tb3VudCwgcmVxKTtcblxuICAgIC8vIFNvbWUgY2xpZW50cyBmb3Igd2hhdGV2ZXIgcmVhc29uIGRvbid0IHNlbmQgUlRTUCBrZWVwYWxpdmUgcmVxdWVzdHNcbiAgICAvLyAoTGl2ZTU1NSBzdHJlYW1pbmcgbWVkaWEgYXMgYW4gZXhhbXBsZSlcbiAgICAvLyBSVFAgc3BlYyBzYXlzIGNvbXBsaWFudCBjbGllbnRzIHNob3VsZCBiZSBzZW5kaW5nIHJ0Y3AgUmVjZWl2ZSBSZXBvcnRzIChSUikgdG8gc2hvdyB0aGVpciBcImxpdmVsaW5lc3NcIlxuICAgIC8vIFNvIHdlIHN1cHBvcnQgdGhpcyBhcyBhIGtlZXBhbGl2ZSB0b28uXG4gICAgY2xpZW50LnJ0Y3BTZXJ2ZXIub24oJ21lc3NhZ2UnLCAoX2J1ZjogQnVmZmVyKSA9PiB7XG4gICAgICB0aGlzLmtlZXBhbGl2ZSgpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5jbGllbnRzW2NsaWVudC5pZF0gPSBjbGllbnQ7XG4gICAgZGVidWcoJyVzIG5ldyBjbGllbnQgJXMnLCB0aGlzLmlkLCBjbGllbnQuaWQpO1xuICAgIHJldHVybiBjbGllbnQ7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHBsYXkgKCk6IHZvaWQge1xuICAgIGZvciAobGV0IGNsaWVudCBpbiB0aGlzLmNsaWVudHMpIHtcbiAgICAgIHRoaXMuY2xpZW50c1tjbGllbnRdLnBsYXkoKTtcbiAgICB9XG5cbiAgICB0aGlzLmtlZXBhbGl2ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjbG9zZSAoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMua2VlcGFsaXZlVGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMua2VlcGFsaXZlVGltZW91dCk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgY2xpZW50IGluIHRoaXMuY2xpZW50cykge1xuICAgICAgdGhpcy5jbGllbnRzW2NsaWVudF0uY2xvc2UoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNsaWVudFNlcnZlci5jbGllbnRHb25lKHRoaXMuaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBrZWVwYWxpdmUgKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmtlZXBhbGl2ZVRpbWVvdXQpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLmtlZXBhbGl2ZVRpbWVvdXQpO1xuICAgIH1cblxuICAgIHRoaXMua2VlcGFsaXZlVGltZW91dCA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgZGVidWcoJyVzIGNsaWVudCB0aW1lb3V0LCBjbG9zaW5nIGNvbm5lY3Rpb24nLCB0aGlzLmlkKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuY2xvc2UoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gSWdub3JlXG4gICAgICB9XG4gICAgfSwgNmU0KTsgLy8gNjAgc2Vjb25kcyAoZG91YmxlIHRoZSBub3JtYWwga2VlcGFsaXZlIGludGVydmFsKVxuICB9XG5cbn1cbiJdfQ==