export const BANNER_OPTIONS = {
    'roundup': [
        { id: 'latest', label: "⚡ Latest Single Result" },
        { id: 'roundup', label: "📆 All Draws for the Day" },
        { id: 'combined_2d_3d', label: "👯 2D/3D Combined" }
    ],
    'winners': [],
    'forecast': [],
    'blueprint': [], 
    'jackpot': [],
    analysis: [] 
};

export const GAME_NAMES = { 
    '6/58': 'Ultra Lotto 6/58', '6/55': 'Grand Lotto 6/55', '6/49': 'Super Lotto 6/49', 
    '6/45': 'Mega Lotto 6/45', '6/42': 'Lotto 6/42', 
    '6D': '6D Lotto', '4D': '4D Lotto', '3D': '3D Swertres', '2D': '2D EZ2' 
};

export const GAME_COLORS_HEX = { 
    '6/58': 'rgba(37, 99, 235, 0.60)', '6/55': 'rgba(0, 176, 255, 0.60)', '6/49': 'rgba(255, 105, 0, 0.60)', 
    '6/45': 'rgba(22, 163, 74, 0.60)', '6/42': 'rgba(234, 179, 8, 0.60)', 
    '6D': 'rgba(0, 201, 179, 0.60)', '4D': 'rgba(99, 102, 241, 0.60)', 
    '3D': 'rgba(147, 51, 234, 0.60)', '2D': 'rgba(220, 38, 38, 0.60)' 
};

export const SCHEDULE_MAP = {
    0: ['6/58', '6/45', '4D', '3D', '2D'], 1: ['4D', '3D', '2D'], 2: ['6D', '3D', '2D'],
    3: ['6/45', '4D', '3D', '2D'], 4: ['6/55', '3D', '2D'], 5: ['6/45', '6D', '3D', '2D'],
    6: ['6/55', '6/42', '6D', '3D', '2D']
};

// NEW: Weekly Blueprint Schedule
export const BLUEPRINT_SCHEDULE = {
    0: ['6/58'], // Sunday -> Ultra Lotto
    1: ['6/55'], // Monday -> Grand Lotto
    2: ['6/49'], // Tuesday -> Super Lotto
    3: ['6/45'], // Wednesday -> Mega Lotto
    4: ['6/42'], // Thursday -> Lotto 6/42
    5: ['4D'],   // Friday -> 4D
    6: ['6D']    // Saturday -> 6D
};