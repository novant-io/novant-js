# Changelog

## Version 0.3 (working)

## Version 0.2 (27-Nov-2026)
* Add `typedefZones`, `typedefSpaces`, `typedefAssets`, and `typedefPoints`
  for the `/v1/typedef` type registry
* Add `dbo` to `Ontology`
* **Breaking:** point props (`schedule`, `mode`, `limit`, `modifier`, ...) are
  moved from top-level keys into a nested `props` object on `Point` and
  `SourceMapPoint`, i.e. `point.schedule` is now `point.props.schedule`
* Add `phase`, `direction`, `simulation`, and `stage` to `PointProps`

## Version 0.1 (26-Nov-2026)
* Initial release, with parity to novant-python 0.7 plus:
  * Add `sourceMaps()` for `/v1/source-maps`
  * Add `access` to project and org project responses
  * Add `influx-scan` explorer op
