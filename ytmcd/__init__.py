#!/usr/bin/env python3

"""
python -m pip install --user -U fastapi uvicorn[standard] databases[sqlite] jinja2
python -m uvicorn ytmcd:app --reload --root-path=/ytmc
http://127.0.0.1:8000/docs
"""

import sys
sys.dont_write_bytecode = True

import os
import time
import jinja2
os.system("")

from fastapi import FastAPI, Request  # fappi...
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

from fastapi.templating import Jinja2Templates
templates = Jinja2Templates(directory="ytmcd")

from databases import Database
db = Database('sqlite:///ytmc.db3')


@app.on_event("startup")
async def startup():
    await db.connect()
    try:
        await db.execute("select * from vids limit 1")
        return
    except:
        pass

    print("creatign db")
    async with db.transaction():
        await db.execute("create table vids (at int, nick text, vid text, title text, chan text)")


class Vid(BaseModel):
    nick: str
    vid: str
    title: str
    chan: str


@app.get("/vids")
async def get_vids():
    ret = []
    q = "select * from vids where at > :lim"
    qa = {"lim": time.time() - 60*60*6}
    async for r in db.iterate(q, qa):
        ret.append(r)
    
    return ret


@app.post("/")
async def post_vid(vid: Vid):
    qa = {"at": int(time.time())}
    qa.update(vid)
    
    qa["nick"] = qa["nick"][:32]
    qa["vid"] = qa["vid"][:11]
    qa["title"] = qa["title"][:64]
    qa["chan"] = qa["chan"][:32]

    async with db.transaction():
        q = "insert into vids values(:at,:nick,:vid,:title,:chan)"
        await db.execute(q, qa)
        
        q = "delete from vids where at < :lim"
        qa = {"lim": time.time() - 60 * 60 * 6}
        await db.execute(q, qa)


@app.get("/", response_class=HTMLResponse)
async def get_index(req: Request):
    vids = await get_vids()
    if not vids:
        return "no vids in db"
    
    keys = [x for x in vids[0].keys() if x not in ["at", "vid"]]
    qa = { "request": req, "keys": keys, "rows": vids, "now": int(time.time()) }
    return templates.TemplateResponse("index.html", qa)
