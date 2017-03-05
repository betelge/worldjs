var Controller = function(object, cam, radius, canvas, document) {

  this.object = object;
  this.cam = cam;

  this.canvas = canvas;
  this.document = document;

  this.isInverted = (object === cam); // Invert controls if object is camera

  this.useAbsoluteZ = false;

  // Controls
  this.STATE = { NONE : -1, PAN : 0, ROTATE : 1, ZOOM : 2, TOUCH_ROTATE : 3, TOUCH_MOVE : 4 };

  this.state = this.STATE.NONE;
  var panStart = vec2.create();
  var panEnd = vec2.create();
  var rotStart = vec2.create();
  var rotEnd = vec2.create();
  var twistStart = 0;
  var twistEnd = 0;
  var twistOn = false;
  var zoomStart = vec2.create();
  var zoomEnd = vec2.create();

  var self = this;

  setupEventListeners();

  function setupEventListeners() {
    canvas.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
    canvas.addEventListener('mousedown', onMouseDown, false); // TODO: Limit only mouse down and mouse wheel to canvas
    canvas.addEventListener('mousewheel', onMouseWheel, false);
    canvas.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox
    //self.canvas.addEventListener( 'keydown', onKeyDown, false );
    canvas.addEventListener( 'touchstart', touchStart, false );
    canvas.addEventListener( 'touchend', touchEnd, false );
    canvas.addEventListener( 'touchmove', touchMove, false );
  }

  function onMouseDown(event) {

    event.preventDefault();

    if (event.button === 0) {
      self.state = self.STATE.PAN;
      vec2.set(panStart, event.clientX, event.clientY);
      vec2.copy(panEnd, panStart);
    }
    else if (event.button === 2) {
      self.state = self.STATE.ROTATE;
      vec2.set(rotStart, event.clientX, event.clientY);
      vec2.copy(rotEnd, rotStart);
    }

    document.addEventListener( 'mousemove', onMouseMove, false );
    document.addEventListener( 'mouseup', onMouseUp, false );

    redraw();
  }

  function onMouseMove(event) {

    if(self.state === self.STATE.NONE)
      return;

    event.preventDefault();

    if (self.state === self.STATE.PAN) {
      vec2.set(panEnd, event.clientX, event.clientY);
    }
    else if (self.state === self.STATE.ROTATE) {
      vec2.set(rotEnd, event.clientX, event.clientY);
    }
  }

  function touchStart(event) {
    switch ( event.touches.length ) {

    case 1:	// one-fingered touch: rotate
      self.state = self.STATE.TOUCH_MOVE;

      var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
      var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

      twistStart = Math.atan(dx, dy);
      twistEnd = twistStart;

      var distance = Math.sqrt( dx * dx + dy * dy );
      vec2.set(zoomStart, 0, distance);
      vec2.copy(zoomEnd, zoomStart);

      var mx = .5 * (event.touches[ 0 ].pageX + event.touches[ 1 ].pageX);
      var my = .5 * (event.touches[ 0 ].pageY + event.touches[ 1 ].pageY);

      vec2.set(panStart, mx, my);
      vec2.copy(panEnd, panStart);
    break;

    default:
      self.state = self.STATE.NONE;
    }

    requestAnimationFrame(update);
  }

  function touchEnd(event) {
    self.state = self.STATE.NONE;
  }

  function touchMove(event) {
    event.preventDefault();
    event.stopPropagation();

    switch ( event.touches.length ) {

      case 1:
        if ( self.state !== self.STATE.TOUCH_ROTATE ) { return; }

        vec2.set(rotEnd, event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
        break;

      case 2:
        if ( self.state !== self.STATE.TOUCH_MOVE ) { return; }

        var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
        var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

        twistEnd = Math.atan2(dx, dy);

        var distance = Math.sqrt( dx * dx + dy * dy );

        vec2.set(zoomEnd, 0, distance);

        var mx = .5 * (event.touches[ 0 ].pageX + event.touches[ 1 ].pageX);
        var my = .5 * (event.touches[ 0 ].pageY + event.touches[ 1 ].pageY);

        vec2.set(panEnd, mx, my);
        break;

      default:
        self.state = self.STATE.NONE;
    }
  }

  this.updateControls = function() {
    switch( self.state ) {

      case self.STATE.PAN:
        pan(panStart, panEnd);
        vec2.copy(panStart, panEnd);
        break;

      case self.STATE.ROTATE:
      case self.STATE.TOUCH_ROTATE:
        var dRot = vec2.create();
        vec2.sub(dRot, rotStart, rotEnd);

        rotate(dRot);

        vec2.copy(rotStart, rotEnd);
        break;

      case self.STATE.TOUCH_MOVE:
        if(twistStart !== twistEnd && twistOn) {
          // Twist
          var zAxis = vec3.create();
          var invRot = mat4.create();

          mat4.invert(invRot, rotMatrix);
          vec3.transformMat4(zAxis, vec3.fromValues(0,0,1), invRot);
          mat4.rotate(rotMatrix, rotMatrix, (twistEnd - twistStart), zAxis);

          twistStart = twistEnd;
        }

        var dPan = vec2.create();
        vec2.sub(dPan, panEnd, panStart);

        pan(panStart, panEnd);

        vec2.copy(panStart, panEnd);

        if(zoomStart[1] === 0 || zoomEnd[1] === zoomStart[1]) return;

        zoom *= Math.abs(zoomStart[1] / zoomEnd[1]);

        vec2.copy(zoomStart, zoomEnd);
        break;

    }
  }

  function pan(panStart, panEnd) {
    if(panStart[0] === panEnd[0] && panStart[1] === panEnd[1])
        return;
    var point0 = vec3.fromValues(2 * panStart[0] / self.canvas.clientWidth - 1, -2 * panStart[1] / self.canvas.clientHeight + 1, 0);
    var point1 = vec3.fromValues(2 * panEnd[0] / self.canvas.clientWidth - 1, -2 * panEnd[1] / self.canvas.clientHeight + 1, 0);
    var hit1 = rayHit(point0);
    var hit2 = rayHit(point1);

    if( !hit1 || !hit2 )
      return;

    if(radius == 0) {// Flat plane
      if(self.isInverted)
        vec3.sub(point1, point0, point1);
      else
        vec3.sub(point1, point1, point0);

      vec3.add(object.position, object.position, point1);
    }
    else { // Sphere

      if(vec3.distance(point0, point1) < radius / 1000) {
        // Angle to small for rotation around planet center
        // Behave like on flat plane
        // TODO: Rotation correction
        if(self.isInverted)
          vec3.sub(point1, point0, point1);
        else
          vec3.sub(point1, point1, point0);

        vec3.add(object.position, object.position, point1);
        return;
      }
      vec3.normalize(point0, point0);
      vec3.normalize(point1, point1);

      var rotQuat = quat.create();
      if(self.isInverted)
        quat.rotationTo(rotQuat, point1, point0);
      else
        quat.rotationTo(rotQuat, point0, point1);
      vec3.transformQuat(cam.position, cam.position, rotQuat);
      quat.mul(cam.rotation, rotQuat, cam.rotation);
    }
  }

  function zoomCam(delta) {
    var zoomSpeed = .1;

    var look = vec3.fromValues(0, 0, -1);
    vec3.transformQuat(look, look, cam.rotation);

    if ( delta < 0 )
      zoomSpeed *= -1;

    var camh = vec3.length(cam.position);
    var margin = .1;
    /*if(camh < radius + margin) {
      vec3.scale(cam.position, cam.position, (radius + margin) / camh);
    }*/

    vec3.scale(look, look, zoomSpeed * Math.max(5, camh - radius));

    vec3.add(cam.position, cam.position, look);
  }

  function rotate(dRot) {
    var tempRot = quat.create();

    if(dRot[0] === 0 && dRot[1] === 0)
      return;

    var rotSpeed = 2;

    if(self.isInverted)
      rotSpeed *= -1;

    quat.invert(tempRot, object.rotation);

    if(self.useAbsoluteZ) {
      var axis = vec3.create();
      if(radius == 0) {// Flat plane
        // Rotation around global z axis
        vec3.set(axis, 0,0,1)
      }
      else { // Sphere
        vec3.copy(axis, cam.position);
        vec3.normalize(axis, axis);
      }
      quat.setAxisAngle(tempRot, axis, -rotSpeed * dRot[0] / canvas.clientWidth);
      quat.mul(object.rotation, tempRot, object.rotation);
    }
    else {
      // Rotation around local y axis
      quat.setAxisAngle(tempRot, vec3.fromValues(0,1,0), -rotSpeed * dRot[0] / canvas.clientWidth);
      quat.mul(object.rotation, object.rotation, tempRot);
    }

    quat.setAxisAngle(tempRot, vec3.fromValues(1,0,0), -rotSpeed * dRot[1] / canvas.clientHeight);
    quat.mul(object.rotation, object.rotation, tempRot);

    //quat.mul(square.rotation, square.rotation, tempRot);
  }

  function rayHit(point) {
    var projMatrixInverse = mat4.create();
    var mvMatrixInverse = mat4.create();
    var justRotInverse = mat3.create();
    var mvMatrix = mat4.create();
    mat4.fromRotationTranslation(mvMatrix,
      cam.rotation, cam.position);

    mat4.invert(projMatrixInverse, projMatUniform.array)
    //mat4.invert(mvMatrixInverse, mvMatrix)
    mat3.fromMat4(justRotInverse, mvMatrix);

    //var camPos = vec3.fromValues(0,0,0);
    //vec3.transformMat4(camPos, camPos, mvMatrixInverse)

    camPos = cam.position;

    vec3.transformMat4(point, point, projMatrixInverse) // Accounts for camera FOV and canvas shape
    vec3.transformMat3(point, point, justRotInverse);

    if(radius == 0) { // Flat plane
      // Project ray onto z == 0 plane
      var distMult = camPos[2] / point[2];
      vec3.scale(point, point, -distMult);
      vec3.add(point, camPos, point);
    }
    else { // Sphere
      var rr = radius * radius;
      vec3.normalize(point, point); // Ray dir
      var ang = vec3.dot(point, camPos);

      if(ang > 0) return false; // No hit

      var a = vec3.clone(point);
      vec3.scale(a, a, -ang);
      vec3.add(a, a, camPos);
      var aa = vec3.dot(a, a);

      if(aa > rr) return false;

      var h = Math.sqrt(rr - aa);
      var inter = vec3.clone(point);
      vec3.scale(inter, inter, -h);
      vec3.add(inter, inter, a);

      vec3.copy(point, inter);
    }

    return true;
  }

  function onMouseWheel(event) {

    event.preventDefault(); // Stops the page from scrolling while zooming

    var delta = 0;

    if ( event.wheelDelta ) {
      delta = event.wheelDelta;
    }
    else if ( event.detail ) { // Firefox
      delta = - event.detail;
    }

    zoomCam(delta);

    redraw();
  }

  function onMouseUp(event) {
    self.state = self.STATE.NONE;

    document.removeEventListener( 'mousemove', onMouseMove, false );
    document.removeEventListener( 'mouseup', onMouseUp, false );
  }
}