#version 300 es
precision mediump float;

in vec2 screenPos;
out vec4 color;

void main() {
    color = vec4(abs(screenPos), 0., 1.);
}
