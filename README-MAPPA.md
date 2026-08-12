# GolfP — chiusura sistema posizioni

## Unica procedura

```bash
npm run geocode:fig
npm run audit:osm
```

Prima del primo comando impostare `GOOGLE_MAPS_KEY` nell'ambiente. Il file
`data/circoli_fig_italia.csv` contiene gli indirizzi FIG e non va modificato a mano.

Il primo comando crea `data/coordinate_fig.json`. Questo file deve essere pubblicato
insieme al progetto: l'app lo legge all'avvio.

Il secondo crea `data/audit_osm.csv`: serve per controllare le differenze fra Google e
OpenStreetMap. Non modifica automaticamente le coordinate dell'app.

## Regola finale della mappa

- **AUTO_OK / Google ROOFTOP** → posizione applicata automaticamente.
- **DA_VERIFICARE** → resta provvisoria.
- **Mirino ⌖** → posizione confermata manualmente e non più sovrascrivibile.
- **OSM** → fonte di controllo e dati del campo, non autorità della posizione.
- **Photon** → legacy, non usato per posizionare automaticamente i campi.
