# addin-heatmap
This add-in is visualizes the location history of a vehicle by displaying areas of "heat" on a map corresponding to the frequency in which they were at a certain location using [leaflet](http://leafletjs.com/) and [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat).

## Installation
Add the configuration below to the to the system setting -> add-ins section of the MyGeotab database

```json
{
  "name": "Heat Map v2",
  "supportEmail": "support@geotab.com",
  "version": "1.0.0",
  "items": [{
    "url": "https://coreymcdonald-lab.github.io/myg-heatmap/",
    "path": "ActivityLink/",
    "menuName": {
      "en": "Heat Map v2"
    },
    "icon": "https://coreymcdonald-lab.github.io/myg-heatmap/images/icon.svg"
  }]
}
```
