/** Simulator environments. Only environments whose simulation capabilities exist are available. */
export const ENVIRONMENTS = [
  {
    id: "training-bench",
    code: "A",
    title: "Electrical Training Bench",
    description: "DC power supply, resistors, knife switch, measurement links and a digital multimeter on a terminal board.",
    status: "available" as const,
    requires: "DC operating-point solver, multimeter model",
  },
  {
    id: "control-cabinet",
    code: "B",
    title: "Control Cabinet",
    description: "Control transformer, contactors, relays, terminal blocks, pushbuttons and pilot lights.",
    status: "planned" as const,
    requires: "Relay/contact settling exists in the engine; AC control power and cabinet interactions are planned.",
  },
  {
    id: "motor-control",
    code: "C",
    title: "Motor Control Station",
    description: "A small motor with starter and control station. Find out why the motor will not start.",
    status: "planned" as const,
    requires: "Three-phase supply, motor and overload models.",
  },
  {
    id: "conveyor",
    code: "D",
    title: "Conveyor Maintenance Station",
    description: "A miniature conveyor with motor control and sensors, with simulated electrical failures.",
    status: "planned" as const,
    requires: "Sensor models, timers and motor control.",
  },
];
