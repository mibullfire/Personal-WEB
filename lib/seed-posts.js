// Posts que estaban escritos a mano en blog.html. Se insertan una sola vez,
// cuando la tabla de posts esta vacia (primer arranque con la base de datos).
module.exports = [
  {
    title: 'hola mundo mibu al habla!',
    created_at: '2026-05-16T14:53:00+02:00',
    mood: 'hasta la polla de los parciales ✦',
    music: 'actualmente: FLORIDA MAN',
    tags: ['primer post'],
    body: [
      'bueno, he tenido la maravillosa idea de hacerme un blog como si fueran los 2000s. xq? Porque estoy en la última semana de examenes y necesito descansar, y no se me ocurre otra cosa que seguir haciendo cosas que tengan que ver con la puta informatica...',
      'llevo queriendo hacer esto un monton de tiempo, es como twitter, pero solo escribo yo, y encima lo ve menos gente, nadie seguramente xd',
      '> #InternetSigueVivo',
      'bueno, gracias por leer esta mierda, y ya iré subiendo cosillas **puruburubum**',
    ].join('\n\n'),
  },
  {
    title: 'comienzo de verano y fin de examenes',
    created_at: '2026-05-17T11:51:00+02:00',
    mood: 'con mucha calor y ganas de playica ✦',
    music: 'actualmente: Make It Look Easy',
    tags: ['fin de examenes'],
    body: [
      'ha sido un curso larguísimo y por fin he terminado los parciales, q me tenían completamente reventado. Llevo una semana medio sin hacer nada y la verdad que lo agradezco muchisimo. Ahora me estoy pasando el *Xenoblade X* y estoy flipando con el juego, me siento como cuando hace 8 años me tumbaba en el sofa y me ponia a jugar al 2 sin ningun tipo de preocupaciones...',
      'y justo hoy he terminado de entregar el ultimo proyecto que tenia de una asignatura, osea que una cosilla menos, ojala se apruebe todo o casi todo en estas semanas.',
    ].join('\n\n'),
  },
  {
    title: 'verano',
    created_at: '2026-06-30T01:07:00+02:00',
    mood: 'contento y con ganas de hacer cosas ✦',
    music: 'purple - Olivia Rodrigo',
    tags: ['cervecitas'],
    body: [
      'vuelvo a escribir en el blog otra vez, ya mi tercer post. La verdad que está siendo un mes super redondo, y estoy muy muy contento. Ya he ido varias veces a Marchena, y quiero muchisisisimo a mis amigos de por alli.',
      'pero no son solo ellos, también mi gente de jerez, mi gente de sevilla y mis amigos repartidos por allí y por allá. Por muchos más *miércoles de montaditos* y cervezas en la playica jeje',
      'y todavía me falta un examen, que lo tengo el 6 de julio, pero bueno voy estudiando poco a poco y creo que lo puedo sacar. Y si no, no pasa nada. Me espera un año duro porque me quiero matricular de todo lo que me queda y son como 90 créditos (contando dos asignaturas que puedo y creo que apruebo en octubre).',
      'pero por ahora, a disfrutar de la semana, a estudiar un poquito, y a pasarlo bien, que lo necesitaba!',
    ].join('\n\n'),
  },
  {
    title: '6 créditos',
    created_at: '2026-07-17T13:15:00+02:00',
    mood: 'felicidad ✦',
    music: 'The Sign - Ace of Base',
    tags: ['jeje god'],
    body: [
      'APROBÉ MI ÚLTIMO EXAMEN',
      'el año que viene me he matriculado de 78 créditos, ya veo el final de mi carrera',
    ].join('\n\n'),
  },
  {
    title: 'Cambios en el Blog',
    created_at: '2026-09-21T18:41:00+02:00',
    mood: 'universidad ✦',
    music: 'Troubles - Alicia Keys',
    tags: ['uni', 'feat'],
    body: [
      'Este es mi primer post después de casi todo el verano, en verdad no he escrito mucho desde que creé la web. Este concretamente, si lo he contado bien es el número 5. Pero al final la idea de esto es escribir cuando tenga un ratito, que para poner gilipolleces ya tengo twitter.',
      'Por ahora el principal cambio ha sido que he agregado una nueva entrada al blog, desde un subdominio. Y he separado mi web principal de esta. Ahora para acceder hay que escribir blog.mibullfire.com.',
      'Pero también quiero ampliar las opciones, como espero tener muchos más post quiero paginar y automatizar todo. Porque para el que entienda de webs, este html es cutrisimo. Es totalemente plano con un montón de .css que me hizo claude para dejarlo todo bonito. Pero todo poquito a poco, conforme vaya agregando cosas, iré comentandolo todo con posts.',
      'Os iré informando mis Internautas! Gracias por leerme.',
    ].join('\n\n'),
  },
];
