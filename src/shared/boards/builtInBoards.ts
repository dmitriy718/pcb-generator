import type { BoardProfile } from '../domain';

export const builtInBoardProfiles: BoardProfile[] = [
  {
    id: 'raspberry-pi-4-model-b',
    name: 'Raspberry Pi 4 Model B',
    family: 'Raspberry Pi',
    source: 'built_in',
    notes: 'Common 85 x 56 mm Raspberry Pi mounting pattern with USB/Ethernet side clearance starter cutouts.',
    pcb: {
      width: 85,
      height: 56,
      thickness: 1.6,
      cornerRadius: 3,
      mountingHoles: [
        { id: 'mh-1', x: 3.5, y: 3.5, diameter: 2.75 },
        { id: 'mh-2', x: 61.5, y: 3.5, diameter: 2.75 },
        { id: 'mh-3', x: 3.5, y: 52.5, diameter: 2.75 },
        { id: 'mh-4', x: 61.5, y: 52.5, diameter: 2.75 },
      ],
      connectorCutouts: [
        { id: 'cutout-usb-ethernet', label: 'USB/Ethernet', side: 'right', offset: 34, z: 10, width: 38, height: 14 },
        { id: 'cutout-usbc-power', label: 'USB-C power', side: 'front', offset: 12, z: 7, width: 10, height: 4 },
        { id: 'cutout-hdmi', label: 'Micro HDMI', side: 'front', offset: 31, z: 7, width: 18, height: 4 },
      ],
    },
  },
  {
    id: 'raspberry-pi-pico',
    name: 'Raspberry Pi Pico',
    family: 'Raspberry Pi',
    source: 'built_in',
    notes: 'Pico-style 51 x 21 mm module with USB end opening and four corner mounting holes.',
    pcb: {
      width: 51,
      height: 21,
      thickness: 1.6,
      cornerRadius: 1,
      mountingHoles: [
        { id: 'mh-1', x: 2, y: 2, diameter: 2.1 },
        { id: 'mh-2', x: 49, y: 2, diameter: 2.1 },
        { id: 'mh-3', x: 2, y: 19, diameter: 2.1 },
        { id: 'mh-4', x: 49, y: 19, diameter: 2.1 },
      ],
      connectorCutouts: [
        { id: 'cutout-micro-usb', label: 'Micro USB', side: 'front', offset: 25.5, z: 6, width: 9, height: 4 },
      ],
    },
  },
  {
    id: 'arduino-uno-r3',
    name: 'Arduino Uno R3',
    family: 'Arduino',
    source: 'built_in',
    notes: 'Uno R3 board envelope with asymmetric mounting holes and USB-B / barrel-jack starter cutouts.',
    pcb: {
      width: 68.6,
      height: 53.4,
      thickness: 1.6,
      cornerRadius: 2,
      mountingHoles: [
        { id: 'mh-1', x: 14, y: 2.5, diameter: 3.2 },
        { id: 'mh-2', x: 66.1, y: 7.6, diameter: 3.2 },
        { id: 'mh-3', x: 66.1, y: 35.5, diameter: 3.2 },
        { id: 'mh-4', x: 15.3, y: 50.8, diameter: 3.2 },
      ],
      connectorCutouts: [
        { id: 'cutout-usb-b', label: 'USB-B', side: 'front', offset: 17, z: 9, width: 13, height: 12 },
        { id: 'cutout-barrel-jack', label: 'Barrel jack', side: 'front', offset: 38, z: 9, width: 11, height: 11 },
      ],
    },
  },
  {
    id: 'arduino-nano',
    name: 'Arduino Nano',
    family: 'Arduino',
    source: 'built_in',
    notes: 'Nano-class module envelope. Many variants omit mounting holes, so this profile starts without holes.',
    pcb: {
      width: 45,
      height: 18,
      thickness: 1.6,
      cornerRadius: 1,
      mountingHoles: [],
      connectorCutouts: [
        { id: 'cutout-mini-usb', label: 'USB', side: 'front', offset: 22.5, z: 6, width: 9, height: 4 },
      ],
    },
  },
  {
    id: 'esp32-devkit-v1',
    name: 'ESP32 DevKit V1',
    family: 'ESP32',
    source: 'built_in',
    notes: 'Common ESP32 DevKit envelope with USB opening. Verify width against clone variants before printing.',
    pcb: {
      width: 55,
      height: 28,
      thickness: 1.6,
      cornerRadius: 1,
      mountingHoles: [],
      connectorCutouts: [
        { id: 'cutout-micro-usb', label: 'Micro USB', side: 'front', offset: 27.5, z: 6, width: 9, height: 4 },
      ],
    },
  },
];

export function boardProfileById(id: string): BoardProfile | undefined {
  return builtInBoardProfiles.find((profile) => profile.id === id);
}
