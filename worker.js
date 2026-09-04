const TMDB_BASE = "https://api.themoviedb.org/3";

const ALLOWED_ORIGINS = [
  "https://ashrafhadii.github.io"
];

const GENRES = {
  28: "أكشن",
  53: "إثارة",
  27: "رعب",
  35: "كوميدي",
  18: "دراما",
  99: "وثائقي",
  16: "أنمي"
};

const LANGUAGES = {
  en: "الإنجليزية",
  ar: "العربية",
  es: "الإسبانية",
  ko: "الكورية",
  it: "الإيطالية",
  tr: "التركية",
  fa: "الفارسية",
  ku: "الكردية",
  ja: "اليابانية",
  zh: "الصينية",
  hi: "الهندية",
  de: "الألمانية",
  fr: "الفرنسية",
  ru: "الروسية",
  pt: "البرتغالية"
};


function corsHeaders(request){

  const origin =
    request.headers.get("Origin") || "";

  const allowed =
    ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods":
      "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type",
    "Access-Control-Max-Age":
      "86400"
  };

}


function json(data,status=200,request){

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers:{
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "public, max-age=300",

        ...corsHeaders(request)
      }
    }
  );

}


function cleanText(value){

  if(!value){
    return "";
  }

  return String(value).trim();

}


function getYear(item){

  const date =
    item.release_date ||
    item.first_air_date ||
    "";

  return date
    ? Number(date.substring(0,4))
    : null;

}


function languageName(code){

  return LANGUAGES[code] ||
    code ||
    "غير معروف";

}


function genreNames(ids){

  if(!Array.isArray(ids)){
    return [];
  }

  return ids
    .map(id => GENRES[id])
    .filter(Boolean);

}


async function tmdb(path,params,env){

  if(!env.TMDB_TOKEN){

    throw new Error(
      "TMDB_TOKEN secret is missing"
    );

  }


  const url =
    new URL(
      TMDB_BASE + path
    );


  Object.entries(params || {})
    .forEach(([key,value]) => {

      if(
        value !== undefined &&
        value !== null &&
        value !== ""
      ){

        url.searchParams.set(
          key,
          value
        );

      }

    });


  const response =
    await fetch(
      url.toString(),
      {
        method:"GET",
        headers:{
          "Authorization":
            `Bearer ${env.TMDB_TOKEN}`,

          "Accept":
            "application/json"
        }
      }
    );


  if(!response.ok){

    const text =
      await response.text();

    throw new Error(
      `TMDB ${response.status}: ${text}`
    );

  }


  return response.json();

}


async function getCredits(
  type,
  id,
  env
){

  return tmdb(
    `/${type}/${id}/credits`,
    {
      language:"ar-SA"
    },
    env
  );

}


function makeDetails(
  item,
  type,
  credits
){

  const isTV =
    type === "tv";


  let director = [];


  if(Array.isArray(credits?.crew)){

    director =
      credits.crew
        .filter(
          person =>
            person.job === "Director"
        )
        .map(
          person =>
            person.name
        )
        .filter(Boolean);

  }


  if(
    isTV &&
    Array.isArray(item.created_by)
  ){

    const creators =
      item.created_by
        .map(
          person =>
            person.name
        )
        .filter(Boolean);


    if(creators.length){

      director =
        creators;

    }

  }


  const cast =
    Array.isArray(credits?.cast)
      ? credits.cast
          .slice(0,20)
          .map(person => ({
            name:
              cleanText(person.name),

            character:
              cleanText(person.character)
          }))
          .filter(
            person => person.name
          )
      : [];


  const genres =
    Array.isArray(item.genres)
      ? item.genres.map(
          genre => genre.name
        )
      : genreNames(item.genre_ids);


  const providers =
    [];


  return {

    id:item.id,

    type,

    title:
      cleanText(
        item.title ||
        item.name
      ),

    original_title:
      cleanText(
        item.original_title ||
        item.original_name
      ),

    year:getYear(item),

    language:
      item.original_language || "",

    language_name:
      languageName(
        item.original_language
      ),

    genres,

    genre_ids:
      Array.isArray(item.genre_ids)
        ? item.genre_ids
        : Array.isArray(item.genres)
          ? item.genres.map(
              genre => genre.id
            )
          : [],

    poster:
      item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "",

    backdrop:
      item.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
        : "",

    rating:
      Number(item.vote_average || 0),

    overview:
      cleanText(item.overview),

    runtime:
      isTV
        ? null
        : item.runtime || null,

    director,

    cast,

    seasons:
      isTV &&
      Array.isArray(item.seasons)
        ? item.seasons.map(
            season => ({
              season_number:
                season.season_number,

              name:
                season.name,

              episode_count:
                season.episode_count || 0
            })
          )
        : [],

    number_of_seasons:
      isTV
        ? item.number_of_seasons || 0
        : null,

    number_of_episodes:
      isTV
        ? item.number_of_episodes || 0
        : null,

    providers

  };

}


async function getDetails(
  type,
  id,
  env
){

  const item =
    await tmdb(
      `/${type}/${id}`,
      {
        language:"ar-SA"
      },
      env
    );


  let credits;


  try{

    credits =
      await getCredits(
        type,
        id,
        env
      );

  }catch{

    credits = {
      cast:[],
      crew:[]
    };

  }


  return makeDetails(
    item,
    type,
    credits
  );

}


async function discover(
  type,
  page,
  env
){

  const endpoint =
    type === "movie"
      ? "/discover/movie"
      : "/discover/tv";


  return tmdb(
    endpoint,
    {
      language:"ar-SA",
      sort_by:"popularity.desc",
      page,
      include_adult:"false",
      include_video:"false"
    },
    env
  );

}


async function handleCatalog(
  request,
  env
){

  const url =
    new URL(request.url);


  const page =
    Math.max(
      1,
      Math.min(
        Number(
          url.searchParams.get("page") || 1
        ),
        500
      )
    );


  const type =
    url.searchParams.get("type") ||
    "all";


  const types =
    type === "movie"
      ? ["movie"]
      : type === "tv"
        ? ["tv"]
        : ["movie","tv"];


  const results = [];


  for(const currentType of types){

    const data =
      await discover(
        currentType,
        page,
        env
      );


    const basicItems =
      Array.isArray(data.results)
        ? data.results
        : [];


    /*
      نأخذ أول 12 من كل نوع
      حتى لا نرسل عددًا ضخمًا من
      طلبات التفاصيل في كل مرة.
    */

    const limited =
      basicItems.slice(0,12);


    for(
      const basic of limited
    ){

      try{

        const details =
          await getDetails(
            currentType,
            basic.id,
            env
          );


        results.push(details);

      }catch(error){

        console.error(
          "Details error:",
          currentType,
          basic.id,
          error.message
        );

      }

    }

  }


  results.sort(
    (a,b) =>
      (b.rating || 0) -
      (a.rating || 0)
  );


  return json(
    {
      updated_at:
        new Date().toISOString(),

      page,

      items:results

    },
    200,
    request
  );

}


async function handleSearch(
  request,
  env
){

  const url =
    new URL(request.url);


  const query =
    url.searchParams.get("q") || "";


  if(!query.trim()){

    return json(
      {
        items:[]
      },
      200,
      request
    );

  }


  const data =
    await tmdb(
      "/search/multi",
      {
        language:"ar-SA",
        query:query.trim(),
        page:
          Math.max(
            1,
            Number(
              url.searchParams.get("page") || 1
            )
          ),
        include_adult:"false"
      },
      env
    );


  const raw =
    Array.isArray(data.results)
      ? data.results
      : [];


  const valid =
    raw.filter(
      item =>
        item.media_type === "movie" ||
        item.media_type === "tv"
    );


  const items = [];


  /*
    التفاصيل من السيرفر،
    وليس من المتصفح.
  */

  for(
    const item of valid.slice(0,12)
  ){

    try{

      const details =
        await getDetails(
          item.media_type,
          item.id,
          env
        );

      items.push(details);

    }catch(error){

      console.error(
        "Search details error:",
        error.message
      );

    }

  }


  return json(
    {
      page:
        data.page || 1,

      total_pages:
        data.total_pages || 1,

      items

    },
    200,
    request
  );

}


async function handleDetails(
  request,
  env
){

  const url =
    new URL(request.url);


  const id =
    Number(
      url.searchParams.get("id")
    );


  const type =
    url.searchParams.get("type");


  if(
    !id ||
    !["movie","tv"].includes(type)
  ){

    return json(
      {
        error:
          "id and type are required"
      },
      400,
      request
    );

  }


  const item =
    await getDetails(
      type,
      id,
      env
    );


  return json(
    item,
    200,
    request
  );

}


export default {

  async fetch(
    request,
    env
  ){

    if(request.method === "OPTIONS"){

      return new Response(
        null,
        {
          status:204,
          headers:
            corsHeaders(request)
        }
      );

    }


    if(request.method !== "GET"){

      return json(
        {
          error:
            "Method not allowed"
        },
        405,
        request
      );

    }


    const url =
      new URL(request.url);


    try{

      if(url.pathname === "/"){

        return json(
          {
            ok:true,
            service:"ACinema API"
          },
          200,
          request
        );

      }


      if(url.pathname === "/catalog"){

        return await handleCatalog(
          request,
          env
        );

      }


   if(url.pathname === "/search"){

    return await handleSearch(
      request,
      env
    );

  }


  if(url.pathname === "/details"){

    return await handleDetails(
      request,
      env
    );

  }


  return json(
    {
      error: "Not found"
    },
    404,
    request
  );


}catch(error){

  console.error(
    error
  );

  return json(
    {
      error: "API request failed",
      details: error?.message || String(error)
    },
    500,
    request
  );

}

};
