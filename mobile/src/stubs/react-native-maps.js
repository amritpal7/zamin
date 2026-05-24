// Web stub — react-native-maps has no web support
import React from 'react';
import { View } from 'react-native';

export default function MapView({ children, style }) {
  return React.createElement(View, { style }, children);
}

export function Marker() { return null; }
export function Polyline() { return null; }
export function Polygon() { return null; }
export function Circle() { return null; }
export function Callout() { return null; }
