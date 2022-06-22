'use strict'

Object.defineProperty( exports, '__esModule', {
	value: true
} )
exports.PublishServer = void 0

var _basicAuth = require( 'basic-auth' )

var _rtspServer = require( 'rtsp-server' )

var _utils = require( './utils' )

const debug = ( 0, _utils.getDebugger )( 'PublishServer' )

/**
 *
 */
class PublishServer {
	/**
   *
   * @param rtspPort
   * @param mounts
   */
	constructor( rtspPort, mounts, hooks ) {
		this.rtspPort = rtspPort
		this.mounts = mounts
		this.hooks = { ...hooks
		}
		this.server = ( 0, _rtspServer.createServer )( ( req, res ) => {
			switch ( req.method ) {
				case 'OPTIONS':
					return this.optionsRequest( req, res )

				case 'ANNOUNCE':
					return this.announceRequest( req, res )

				case 'SETUP':
					return this.setupRequest( req, res )

				case 'RECORD':
					return this.recordRequest( req, res )

				case 'TEARDOWN':
					return this.teardownRequest( req, res )

				default:
					console.error( 'Unknown PublishServer request', {
						method: req.method,
						url: req.url
					} )
					res.statusCode = 501 // Not implemented

					return res.end()
			}
		} )
	}
	/**
   *
   */


	async start() {
		return new Promise( resolve => {
			this.server.listen( this.rtspPort, () => {
				debug( 'Now listening on %s', this.rtspPort )
				return resolve()
			} )
		} )
	}
	/**
   *
   * @param req
   * @param res
   */


	optionsRequest( req, res ) {
		debug( 'Options request from %s with headers %o', req.socket.remoteAddress, req.headers )
		res.setHeader( 'OPTIONS', 'DESCRIBE SETUP ANNOUNCE RECORD' )
		return res.end()
	}
	/**
   *
   * @param req
   * @param res
   */


	async announceRequest( req, res ) {
		debug( '%s:%s - Announce request with headers %o', req.socket.remoteAddress, req.socket.remotePort, req.headers ) // Ask for authentication

		if ( this.hooks.authentication ) {
			if ( !req.headers.authorization ) {
				debug( '%s:%s - No authentication information (required), sending 401', req.socket.remoteAddress, req.socket.remotePort )
				res.setHeader( 'WWW-Authenticate', 'Basic realm="rtsp"' )
				res.statusCode = 401
				return res.end()
			} else {
				const result = ( 0, _basicAuth.parse )( req.headers.authorization )

				if ( !result ) {
					debug( '%s:%s - Invalid authentication information (required), sending 401', req.socket.remoteAddress, req.socket.remotePort )
					res.setHeader( 'WWW-Authenticate', 'Basic realm="rtsp"' )
					res.statusCode = 401
					return res.end()
				}

				const allowed = await this.hooks.authentication( result.name, result.pass, req, res )

				if ( !allowed ) {
					debug( '%s:%s - Invalid authentication information (Hook returned false), sending 401', req.socket.remoteAddress, req.socket.remotePort )
					res.setHeader( 'WWW-Authenticate', 'Basic realm="rtsp"' )
					res.statusCode = 401
					return res.end()
				}

				this.authenticatedHeader = req.headers.authorization
			}
		}

		let sdpBody = ''
		req.on( 'data', buf => {
			sdpBody += buf.toString()
		} )
		req.on( 'end', async () => {
			// Hook to check if this mount should exist or be allowed to be published
			if ( this.hooks.checkMount ) {
				const allowed = await this.hooks.checkMount( req )

				if ( !allowed ) {
					debug( '%s:%s path not allowed by hook', req.socket.remoteAddress, req.socket.remotePort, req.uri )
					res.statusCode = 403
					return res.end()
				}
			}

			let mount = this.mounts.getMount( req.uri ) // If the mount already exists, reject

			// if ( mount ) {
			// 	debug( '%s:%s - Mount already existed, sending 503: %o', req.socket.remoteAddress, req.socket.remotePort, req.uri )
			// 	res.statusCode = 503
			// 	return res.end()
			// }

			mount = this.mounts.addMount( req.uri, sdpBody, this.hooks )
			res.setHeader( 'Session', `${mount.id};timeout=30` )
			debug( '%s:%s - Set session to %s', req.socket.remoteAddress, req.socket.remotePort, mount.id )
			res.end()
		} )
	}
	/**
   *
   * @param req
   * @param res
   */


	setupRequest( req, res ) {
		// Authentication check
		if ( !this.checkAuthenticated( req, res ) ) {
			return
		}

		const mount = this.mounts.getMount( req.uri )

		if ( !mount ) {
			debug( '%s:%s - No mount with path %s exists', req.socket.remoteAddress, req.socket.remotePort, req.uri )
			res.statusCode = 404 // Unknown stream

			return res.end()
		} // TCP not supported (yet ;-))


		if ( req.headers.transport && -1 < req.headers.transport.toLowerCase().indexOf( 'tcp' ) ) {
			debug( '%s:%s - TCP not yet supported - sending 501', req.socket.remoteAddress, req.socket.remotePort, req.uri )
			res.statusCode = 501 // Not Implemented

			return res.end()
		}

		const create = mount.createStream( req.uri )
		res.setHeader( 'Transport', `${req.headers.transport};server_port=${create.rtpStartPort}-${create.rtpEndPort}` )
		res.end()
	}
	/**
   *
   * @param req
   * @param res
   */


	async recordRequest( req, res ) {
		// Authentication check
		if ( !this.checkAuthenticated( req, res ) ) {
			return
		}

		let mount = this.mounts.getMount( req.uri )

		if ( !mount || mount.id !== req.headers.session ) {
			debug( '%s:%s - No mount with path %s exists, or the session was invalid', req.socket.remoteAddress, req.socket.remotePort, req.uri )
			res.statusCode = 454 // Session Not Found

			return res.end()
		}

		if ( req.headers.range ) {
			mount.range = req.headers.range
		}

		try {
			await mount.setup()
		} catch ( e ) {
			console.error( 'Error setting up record request', e )
			res.statusCode = 500
		}

		res.end()
	}
	/**
   *
   * @param req
   * @param res
   */


	teardownRequest( req, res ) {
		// Authentication check
		if ( !this.checkAuthenticated( req, res ) ) {
			return
		}

		debug( '%s:%s - teardown %s', req.socket.remoteAddress, req.socket.remotePort, req.uri )
		this.mounts.deleteMount( req.uri )
		res.end()
	}
	/**
   *
   * @param req
   * @param res
   */


	checkAuthenticated( req, res ) {
		if ( this.hooks.authentication && this.authenticatedHeader ) {
			if ( req.headers.authorization !== this.authenticatedHeader ) {
				debug( '%s:%s - auth header mismatch (401) %O', req.socket.remoteAddress, req.socket.remotePort, req.headers )
				res.statusCode = 401
				res.end()
				return false
			}
		}

		return true
	}

}

exports.PublishServer = PublishServer
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvUHVibGlzaFNlcnZlci50cyJdLCJuYW1lcyI6WyJkZWJ1ZyIsIlB1Ymxpc2hTZXJ2ZXIiLCJjb25zdHJ1Y3RvciIsInJ0c3BQb3J0IiwibW91bnRzIiwiaG9va3MiLCJzZXJ2ZXIiLCJyZXEiLCJyZXMiLCJtZXRob2QiLCJvcHRpb25zUmVxdWVzdCIsImFubm91bmNlUmVxdWVzdCIsInNldHVwUmVxdWVzdCIsInJlY29yZFJlcXVlc3QiLCJ0ZWFyZG93blJlcXVlc3QiLCJjb25zb2xlIiwiZXJyb3IiLCJ1cmwiLCJzdGF0dXNDb2RlIiwiZW5kIiwic3RhcnQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImxpc3RlbiIsInNvY2tldCIsInJlbW90ZUFkZHJlc3MiLCJoZWFkZXJzIiwic2V0SGVhZGVyIiwicmVtb3RlUG9ydCIsImF1dGhlbnRpY2F0aW9uIiwiYXV0aG9yaXphdGlvbiIsInJlc3VsdCIsImFsbG93ZWQiLCJuYW1lIiwicGFzcyIsImF1dGhlbnRpY2F0ZWRIZWFkZXIiLCJzZHBCb2R5Iiwib24iLCJidWYiLCJ0b1N0cmluZyIsImNoZWNrTW91bnQiLCJ1cmkiLCJtb3VudCIsImdldE1vdW50IiwiYWRkTW91bnQiLCJpZCIsImNoZWNrQXV0aGVudGljYXRlZCIsInRyYW5zcG9ydCIsInRvTG93ZXJDYXNlIiwiaW5kZXhPZiIsImNyZWF0ZSIsImNyZWF0ZVN0cmVhbSIsInJ0cFN0YXJ0UG9ydCIsInJ0cEVuZFBvcnQiLCJzZXNzaW9uIiwicmFuZ2UiLCJzZXR1cCIsImUiLCJkZWxldGVNb3VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBOztBQUNBOztBQUlBOztBQUVBLE1BQU1BLEtBQUssR0FBRyx3QkFBWSxlQUFaLENBQWQ7O0FBUUE7OztBQUdPLE1BQU1DLGFBQU4sQ0FBb0I7QUFRekI7Ozs7O0FBS0FDLEVBQUFBLFdBQVcsQ0FBRUMsUUFBRixFQUFvQkMsTUFBcEIsRUFBb0NDLEtBQXBDLEVBQXNFO0FB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QUFDb0IsT0FBSixDQUFZSSxhQUFaLEtBQThCLEtBQUtLLG1CQUF2QyxFQUE0RDtBQUMxRHBDLFFBQUFBLEtBQUssQ0FBQyx1Q0FBRCxFQUEwQ08sR0FBRyxDQUFDa0IsTUFBSixDQUFXQyxhQUFyRCxFQUFvRW5CLEdBQUcsQ0FBQ2tCLE1BQUosQ0FBV0ksVUFBL0UsRUFBMkZ0QixHQUFHLENBQUNvQixPQUEvRixDQUFMO0FBQ0FuQixRQUFBQSxHQUFHLENBQUNVLFVBQUosR0FBaUIsR0FBakI7QUFDQVYsUUFBQUEsR0FBRyxDQUFDVyxHQUFKO0FBQ0EsZUFBTyxLQUFQO0FBQ0Q7QUFDRjs7QUFFRCxXQUFPLElBQVA7QUFDRDs7QUFwT3dCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGFyc2UgfSBmcm9tICdiYXNpYy1hdXRoJztcbmltcG9ydCB7IGNyZWF0ZVNlcnZlciwgUnRzcFJlcXVlc3QsIFJ0c3BSZXNwb25zZSwgUnRzcFNlcnZlciB9IGZyb20gJ3J0c3Atc2VydmVyJztcblxuaW1wb3J0IHsgTW91bnQgfSBmcm9tICcuL01vdW50JztcbmltcG9ydCB7IE1vdW50cyB9IGZyb20gJy4vTW91bnRzJztcbmltcG9ydCB7IGdldERlYnVnZ2VyIH0gZnJvbSAnLi91dGlscyc7XG5cbmNvbnN0IGRlYnVnID0gZ2V0RGVidWdnZXIoJ1B1Ymxpc2hTZXJ2ZXInKTtcblxuZXhwb3J0IGludGVyZmFjZSBQdWJsaXNoU2VydmVySG9va3NDb25maWcge1xuICBhdXRoZW50aWNhdGlvbj86ICh1c2VybmFtZTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nLCByZXE6IFJ0c3BSZXF1ZXN0LCByZXM6IFJ0c3BSZXNwb25zZSkgPT4gUHJvbWlzZTxib29sZWFuPjtcbiAgY2hlY2tNb3VudD86IChyZXE6IFJ0c3BSZXF1ZXN0KSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuICBtb3VudE5vd0VtcHR5PzogKG1vdW50OiBNb3VudCkgPT4gUHJvbWlzZTx2b2lkPjtcbn1cblxuLyoqXG4gKlxuICovXG5leHBvcnQgY2xhc3MgUHVibGlzaFNlcnZlciB7XG4gIGhvb2tzOiBQdWJsaXNoU2VydmVySG9va3NDb25maWc7XG4gIG1vdW50czogTW91bnRzO1xuICBydHNwUG9ydDogbnVtYmVyO1xuICBzZXJ2ZXI6IFJ0c3BTZXJ2ZXI7XG5cbiAgYXV0aGVudGljYXRlZEhlYWRlcj86IHN0cmluZztcblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHJ0c3BQb3J0XG4gICAqIEBwYXJhbSBtb3VudHNcbiAgICovXG4gIGNvbnN0cnVjdG9yIChydHNwUG9ydDogbnVtYmVyLCBtb3VudHM6IE1vdW50cywgaG9va3M/OiBQdWJsaXNoU2VydmVySG9va3NDb25maWcpIHtcbiAgICB0aGlzLnJ0c3BQb3J0ID0gcnRzcFBvcnQ7XG4gICAgdGhpcy5tb3VudHMgPSBtb3VudHM7XG5cbiAgICB0aGlzLmhvb2tzID0ge1xuICAgICAgLi4uaG9va3NcbiAgICB9O1xuXG4gICAgdGhpcy5zZXJ2ZXIgPSBjcmVhdGVTZXJ2ZXIoKHJlcTogUnRzcFJlcXVlc3QsIHJlczogUnRzcFJlc3BvbnNlKSA9PiB7XG4gICAgICBzd2l0Y2ggKHJlcS5tZXRob2QpIHtcbiAgICAgICAgY2FzZSAnT1BUSU9OUyc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1JlcXVlc3QocmVxLCByZXMpO1xuICAgICAgICBjYXNlICdBTk5PVU5DRSc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYW5ub3VuY2VSZXF1ZXN0KHJlcSwgcmVzKTtcbiAgICAgICAgY2FzZSAnU0VUVVAnOlxuICAgICAgICAgIHJldHVybiB0aGlzLnNldHVwUmVxdWVzdChyZXEsIHJlcyk7XG4gICAgICAgIGNhc2UgJ1JFQ09SRCc6XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVjb3JkUmVxdWVzdChyZXEsIHJlcyk7XG4gICAgICAgIGNhc2UgJ1RFQVJET1dOJzpcbiAgICAgICAgICByZXR1cm4gdGhpcy50ZWFyZG93blJlcXVlc3QocmVxLCByZXMpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Vua25vd24gUHVibGlzaFNlcnZlciByZXF1ZXN0JywgeyBtZXRob2Q6IHJlcS5tZXRob2QsIHVybDogcmVxLnVybCB9KTtcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMTsgLy8gTm90IGltcGxlbWVudGVkXG4gICAgICAgICAgcmV0dXJuIHJlcy5lbmQoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgc3RhcnQgKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLnNlcnZlci5saXN0ZW4odGhpcy5ydHNwUG9ydCwgKCkgPT4ge1xuICAgICAgICBkZWJ1ZygnTm93IGxpc3RlbmluZyBvbiAlcycsIHRoaXMucnRzcFBvcnQpO1xuXG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gcmVxXG4gICAqIEBwYXJhbSByZXNcbiAgICovXG4gIG9wdGlvbnNSZXF1ZXN0IChyZXE6IFJ0c3BSZXF1ZXN0LCByZXM6IFJ0c3BSZXNwb25zZSkge1xuICAgIGRlYnVnKCdPcHRpb25zIHJlcXVlc3QgZnJvbSAlcyB3aXRoIGhlYWRlcnMgJW8nLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5oZWFkZXJzKTtcbiAgICByZXMuc2V0SGVhZGVyKCdPUFRJT05TJywgJ0RFU0NSSUJFIFNFVFVQIEFOTk9VTkNFIFJFQ09SRCcpO1xuICAgIHJldHVybiByZXMuZW5kKCk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICogQHBhcmFtIHJlcVxuICAgKiBAcGFyYW0gcmVzXG4gICAqL1xuICBhc3luYyBhbm5vdW5jZVJlcXVlc3QgKHJlcTogUnRzcFJlcXVlc3QsIHJlczogUnRzcFJlc3BvbnNlKSB7XG4gICAgZGVidWcoJyVzOiVzIC0gQW5ub3VuY2UgcmVxdWVzdCB3aXRoIGhlYWRlcnMgJW8nLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5zb2NrZXQucmVtb3RlUG9ydCwgcmVxLmhlYWRlcnMpO1xuICAgIC8vIEFzayBmb3IgYXV0aGVudGljYXRpb25cbiAgICBpZiAodGhpcy5ob29rcy5hdXRoZW50aWNhdGlvbikge1xuICAgICAgaWYgKCFyZXEuaGVhZGVycy5hdXRob3JpemF0aW9uKSB7XG4gICAgICAgIGRlYnVnKCclczolcyAtIE5vIGF1dGhlbnRpY2F0aW9uIGluZm9ybWF0aW9uIChyZXF1aXJlZCksIHNlbmRpbmcgNDAxJywgcmVxLnNvY2tldC5yZW1vdGVBZGRyZXNzLCByZXEuc29ja2V0LnJlbW90ZVBvcnQpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdXV1ctQXV0aGVudGljYXRlJywgJ0Jhc2ljIHJlYWxtPVwicnRzcFwiJyk7XG4gICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAxO1xuICAgICAgICByZXR1cm4gcmVzLmVuZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gcGFyc2UocmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbik7XG4gICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgZGVidWcoJyVzOiVzIC0gSW52YWxpZCBhdXRoZW50aWNhdGlvbiBpbmZvcm1hdGlvbiAocmVxdWlyZWQpLCBzZW5kaW5nIDQwMScsIHJlcS5zb2NrZXQucmVtb3RlQWRkcmVzcywgcmVxLnNvY2tldC5yZW1vdGVQb3J0KTtcbiAgICAgICAgICByZXMuc2V0SGVhZGVyKCdXV1ctQXV0aGVudGljYXRlJywgJ0Jhc2ljIHJlYWxtPVwicnRzcFwiJyk7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDE7XG4gICAgICAgICAgcmV0dXJuIHJlcy5lbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbG93ZWQgPSBhd2FpdCB0aGlzLmhvb2tzLmF1dGhlbnRpY2F0aW9uKHJlc3VsdC5uYW1lLCByZXN1bHQucGFzcywgcmVxLCByZXMpO1xuICAgICAgICBpZiAoIWFsbG93ZWQpIHtcbiAgICAgICAgICBkZWJ1ZygnJXM6JXMgLSBJbnZhbGlkIGF1dGhlbnRpY2F0aW9uIGluZm9ybWF0aW9uIChIb29rIHJldHVybmVkIGZhbHNlKSwgc2VuZGluZyA0MDEnLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5zb2NrZXQucmVtb3RlUG9ydCk7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcignV1dXLUF1dGhlbnRpY2F0ZScsICdCYXNpYyByZWFsbT1cInJ0c3BcIicpO1xuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAxO1xuICAgICAgICAgIHJldHVybiByZXMuZW5kKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF1dGhlbnRpY2F0ZWRIZWFkZXIgPSByZXEuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBzZHBCb2R5ID0gJyc7XG4gICAgcmVxLm9uKCdkYXRhJywgKGJ1ZikgPT4ge1xuICAgICAgc2RwQm9keSArPSBidWYudG9TdHJpbmcoKTtcbiAgICB9KTtcblxuICAgIHJlcS5vbignZW5kJywgYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gSG9vayB0byBjaGVjayBpZiB0aGlzIG1vdW50IHNob3VsZCBleGlzdCBvciBiZSBhbGxvd2VkIHRvIGJlIHB1Ymxpc2hlZFxuICAgICAgaWYgKHRoaXMuaG9va3MuY2hlY2tNb3VudCkge1xuICAgICAgICBjb25zdCBhbGxvd2VkID0gYXdhaXQgdGhpcy5ob29rcy5jaGVja01vdW50KHJlcSk7XG4gICAgICAgIGlmICghYWxsb3dlZCkge1xuICAgICAgICAgIGRlYnVnKCclczolcyBwYXRoIG5vdCBhbGxvd2VkIGJ5IGhvb2snLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5zb2NrZXQucmVtb3RlUG9ydCwgcmVxLnVyaSk7XG4gICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDM7XG4gICAgICAgICAgcmV0dXJuIHJlcy5lbmQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXQgbW91bnQgPSB0aGlzLm1vdW50cy5nZXRNb3VudChyZXEudXJpKTtcblxuICAgICAgLy8gSWYgdGhlIG1vdW50IGFscmVhZHkgZXhpc3RzLCByZWplY3RcbiAgICAgIGlmIChtb3VudCkge1xuICAgICAgICBkZWJ1ZygnJXM6JXMgLSBNb3VudCBhbHJlYWR5IGV4aXN0ZWQsIHNlbmRpbmcgNTAzOiAlbycsIHJlcS5zb2NrZXQucmVtb3RlQWRkcmVzcywgcmVxLnNvY2tldC5yZW1vdGVQb3J0LCByZXEudXJpKTtcbiAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDM7XG4gICAgICAgIHJldHVybiByZXMuZW5kKCk7XG4gICAgICB9XG5cbiAgICAgIG1vdW50ID0gdGhpcy5tb3VudHMuYWRkTW91bnQocmVxLnVyaSwgc2RwQm9keSwgdGhpcy5ob29rcyk7XG4gICAgICByZXMuc2V0SGVhZGVyKCdTZXNzaW9uJywgYCR7bW91bnQuaWR9O3RpbWVvdXQ9MzBgKTtcbiAgICAgIGRlYnVnKCclczolcyAtIFNldCBzZXNzaW9uIHRvICVzJywgcmVxLnNvY2tldC5yZW1vdGVBZGRyZXNzLCByZXEuc29ja2V0LnJlbW90ZVBvcnQsIG1vdW50LmlkKTtcblxuICAgICAgcmVzLmVuZCgpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSByZXFcbiAgICogQHBhcmFtIHJlc1xuICAgKi9cbiAgc2V0dXBSZXF1ZXN0IChyZXE6IFJ0c3BSZXF1ZXN0LCByZXM6IFJ0c3BSZXNwb25zZSkge1xuICAgIC8vIEF1dGhlbnRpY2F0aW9uIGNoZWNrXG4gICAgaWYgKCF0aGlzLmNoZWNrQXV0aGVudGljYXRlZChyZXEsIHJlcykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtb3VudCA9IHRoaXMubW91bnRzLmdldE1vdW50KHJlcS51cmkpO1xuICAgIGlmICghbW91bnQpIHtcbiAgICAgIGRlYnVnKCclczolcyAtIE5vIG1vdW50IHdpdGggcGF0aCAlcyBleGlzdHMnLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5zb2NrZXQucmVtb3RlUG9ydCwgcmVxLnVyaSk7XG4gICAgICByZXMuc3RhdHVzQ29kZSA9IDQwNDsgLy8gVW5rbm93biBzdHJlYW1cbiAgICAgIHJldHVybiByZXMuZW5kKCk7XG4gICAgfVxuXG4gICAgLy8gVENQIG5vdCBzdXBwb3J0ZWQgKHlldCA7LSkpXG4gICAgaWYgKHJlcS5oZWFkZXJzLnRyYW5zcG9ydCAmJiByZXEuaGVhZGVycy50cmFuc3BvcnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCd0Y3AnKSA+IC0xKSB7XG4gICAgICBkZWJ1ZygnJXM6JXMgLSBUQ1Agbm90IHlldCBzdXBwb3J0ZWQgLSBzZW5kaW5nIDUwMScsIHJlcS5zb2NrZXQucmVtb3RlQWRkcmVzcywgcmVxLnNvY2tldC5yZW1vdGVQb3J0LCByZXEudXJpKTtcbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAxOyAvLyBOb3QgSW1wbGVtZW50ZWRcbiAgICAgIHJldHVybiByZXMuZW5kKCk7XG4gICAgfVxuXG4gICAgY29uc3QgY3JlYXRlID0gbW91bnQuY3JlYXRlU3RyZWFtKHJlcS51cmkpO1xuICAgIHJlcy5zZXRIZWFkZXIoJ1RyYW5zcG9ydCcsIGAke3JlcS5oZWFkZXJzLnRyYW5zcG9ydH07c2VydmVyX3BvcnQ9JHtjcmVhdGUucnRwU3RhcnRQb3J0fS0ke2NyZWF0ZS5ydHBFbmRQb3J0fWApO1xuICAgIHJlcy5lbmQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gcmVxXG4gICAqIEBwYXJhbSByZXNcbiAgICovXG4gIGFzeW5jIHJlY29yZFJlcXVlc3QgKHJlcTogUnRzcFJlcXVlc3QsIHJlczogUnRzcFJlc3BvbnNlKSB7XG4gICAgLy8gQXV0aGVudGljYXRpb24gY2hlY2tcbiAgICBpZiAoIXRoaXMuY2hlY2tBdXRoZW50aWNhdGVkKHJlcSwgcmVzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBtb3VudCA9IHRoaXMubW91bnRzLmdldE1vdW50KHJlcS51cmkpO1xuXG4gICAgaWYgKCFtb3VudCB8fCBtb3VudC5pZCAhPT0gcmVxLmhlYWRlcnMuc2Vzc2lvbikge1xuICAgICAgZGVidWcoJyVzOiVzIC0gTm8gbW91bnQgd2l0aCBwYXRoICVzIGV4aXN0cywgb3IgdGhlIHNlc3Npb24gd2FzIGludmFsaWQnLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5zb2NrZXQucmVtb3RlUG9ydCwgcmVxLnVyaSk7XG4gICAgICByZXMuc3RhdHVzQ29kZSA9IDQ1NDsgLy8gU2Vzc2lvbiBOb3QgRm91bmRcbiAgICAgIHJldHVybiByZXMuZW5kKCk7XG4gICAgfVxuXG4gICAgaWYgKHJlcS5oZWFkZXJzLnJhbmdlKSB7XG4gICAgICBtb3VudC5yYW5nZSA9IHJlcS5oZWFkZXJzLnJhbmdlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBtb3VudC5zZXR1cCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNldHRpbmcgdXAgcmVjb3JkIHJlcXVlc3QnLCBlKTtcbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xuICAgIH1cblxuICAgIHJlcy5lbmQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gcmVxXG4gICAqIEBwYXJhbSByZXNcbiAgICovXG4gIHRlYXJkb3duUmVxdWVzdCAocmVxOiBSdHNwUmVxdWVzdCwgcmVzOiBSdHNwUmVzcG9uc2UpIHtcbiAgICAvLyBBdXRoZW50aWNhdGlvbiBjaGVja1xuICAgIGlmICghdGhpcy5jaGVja0F1dGhlbnRpY2F0ZWQocmVxLCByZXMpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZGVidWcoJyVzOiVzIC0gdGVhcmRvd24gJXMnLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MsIHJlcS5zb2NrZXQucmVtb3RlUG9ydCwgcmVxLnVyaSk7XG4gICAgdGhpcy5tb3VudHMuZGVsZXRlTW91bnQocmVxLnVyaSk7XG4gICAgcmVzLmVuZCgpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSByZXFcbiAgICogQHBhcmFtIHJlc1xuICAgKi9cbiAgcHJpdmF0ZSBjaGVja0F1dGhlbnRpY2F0ZWQgKHJlcTogUnRzcFJlcXVlc3QsIHJlczogUnRzcFJlc3BvbnNlKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuaG9va3MuYXV0aGVudGljYXRpb24gJiYgdGhpcy5hdXRoZW50aWNhdGVkSGVhZGVyKSB7XG4gICAgICBpZiAocmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbiAhPT0gdGhpcy5hdXRoZW50aWNhdGVkSGVhZGVyKSB7XG4gICAgICAgIGRlYnVnKCclczolcyAtIGF1dGggaGVhZGVyIG1pc21hdGNoICg0MDEpICVPJywgcmVxLnNvY2tldC5yZW1vdGVBZGRyZXNzLCByZXEuc29ja2V0LnJlbW90ZVBvcnQsIHJlcS5oZWFkZXJzKTtcbiAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDE7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG4iXX0=