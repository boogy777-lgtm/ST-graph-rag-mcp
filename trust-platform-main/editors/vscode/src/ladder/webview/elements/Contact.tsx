import React from "react";
import { Group, Rect, Line, Text, Circle } from "react-konva";
import type { ContactType } from "../../ladderEngine";

interface ContactProps {
  x: number;
  y: number;
  contactType: ContactType;
  variable: string;
  onDragEnd?: (e: any) => void;
  isActive?: boolean;
}

export function Contact({ x, y, contactType, variable, onDragEnd, isActive = false }: ContactProps) {
  const width = 50;
  const height = 60;
  
  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragEnd={onDragEnd}
    >
      {/* Background when active */}
      {isActive && (
        <Rect
          x={-5}
          y={-5}
          width={width + 10}
          height={height + 10}
          fill="rgba(255, 165, 0, 0.2)"
          cornerRadius={5}
        />
      )}
      
      {/* Contact symbol */}
      {contactType === 'NO' ? (
        // Normally Open - two vertical lines
        <>
          <Line points={[10, 0, 10, 25]} stroke="black" strokeWidth={3} />
          <Line points={[10, 35, 10, 60]} stroke="black" strokeWidth={3} />
          <Line points={[30, 0, 30, 25]} stroke="black" strokeWidth={3} />
          <Line points={[30, 35, 30, 60]} stroke="black" strokeWidth={3} />
        </>
      ) : (
        // Normally Closed - two vertical lines with horizontal connection
        <>
          <Line points={[10, 0, 10, 60]} stroke="black" strokeWidth={3} />
          <Line points={[30, 0, 30, 60]} stroke="black" strokeWidth={3} />
          <Line points={[10, 30, 30, 30]} stroke="black" strokeWidth={3} />
        </>
      )}
      
      {/* Variable label */}
      <Text
        text={variable}
        y={65}
        width={width}
        align="center"
        fontSize={11}
        fontFamily="monospace"
        fill={isActive ? "orange" : "black"}
        fontStyle={isActive ? "bold" : "normal"}
      />
      
      {/* Connection points */}
      <Circle x={20} y={0} radius={3} fill="blue" opacity={0.3} />
      <Circle x={20} y={60} radius={3} fill="blue" opacity={0.3} />
    </Group>
  );
}
