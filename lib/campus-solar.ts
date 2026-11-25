/** NOAA approximate solar equations; UTC input avoids dependence on the visitor's timezone.
 * Source: https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF */
export function campusSunPosition(date:Date,latitude=22.3364,longitude=114.2655){
 const year=date.getUTCFullYear(),leap=year%4===0&&(year%100!==0||year%400===0);
 const day=Math.floor((Date.UTC(year,date.getUTCMonth(),date.getUTCDate())-Date.UTC(year,0,1))/86400000)+1;
 const hour=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600;
 const g=2*Math.PI/(leap?366:365)*(day-1+(hour-12)/24);
 const equation=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const solarMinutes=((hour*60+equation+4*longitude)%1440+1440)%1440;
 const ha=(solarMinutes/4-180)*Math.PI/180,lat=latitude*Math.PI/180;
 const elevation=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha))))*180/Math.PI;
 const azimuth=(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(decl)*Math.cos(lat))*180/Math.PI+180+360)%360;
 const phase=elevation < -6 ? 'Night' : elevation < 10 ? (ha<0?'Sunrise':'Sunset') : 'Day';
 return {elevation,azimuth,phase};
}
