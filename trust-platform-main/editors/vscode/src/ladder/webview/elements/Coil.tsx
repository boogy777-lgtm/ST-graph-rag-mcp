import React from "react";
import { Group, Circle, Line, Text, Rect } from "react-konva";
import type { CoilType } from "../../ladderEngine";

interface CoilProps {
  x: number;
  y: number;
  coilType: CoilType;
  variable: string;
  onDragEnd?: (e: any) => void;
  isActive?: boolean;
}

export function Coil({ x, y, coilType, variable, onDragEnd, isActive = false }: CoilProps) {
  const width = 50;
  const height = 60;
  const radius = 20;
  
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
      
      {/* Circle symbol */}
      <Circle
        x={25}
        y={30}
        radius={radius}
        stroke="black"
        strokeWidth={3}
        fill={isActive ? "rgba(255, 165, 0, 0.3)" : "transparent"}
      />
      
      {/* Coil type markers */}
      {coilType === 'SET' && (
        <Text
          text="S"
          x={20}
          y={22}
          fontSize={18}
          fontFamily="monospace"
          fontStyle="bold"
        />
      )}
      {coilType === 'RESET' && (
        <Text
          text="R"
          x={20}
          y={22}
          fontSize={18}
          fontFamily="monospace"
          fontStyle="bold"
        />
      )}
      {coilType === 'NEGATED' && (
        <Line
          points={[35, 30, 45, 30]}
          stroke="black"
          strokeWidth={2}
        />
      )}
      
      {/* Connection lines */}
      <Line points={[25, 0, 25, 10]} stroke="black" strokeWidth={3} />
      <Line points={[25, 50, 25, 60]} stroke="black" strokeWidth={3} />
      
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
      <Circle x={25} y={0} radius={3} fill="blue" opacity={0.3} />
      <Circle x={25} y={60} radius={3} fill="blue" opacity={0.3} />
    </Group>
  );
}
