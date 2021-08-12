#!/usr/bin/env python3

"""
python -m pip install --user -U fastapi uvicorn[standard] databases[sqlite]
python -m uvicorn ytmcd:app --reload
http://127.0.0.1:8000/docs
"""

import sys
sys.dont_write_bytecode = True

import os
os.system("")

import time

from fastapi import FastAPI  # fappi...
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
app = FastAPI()

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
        await db.execute("create table vids (at int, nick text, vid text, title text, tuber text)")


class Vid(BaseModel):
    nick: str
    vid: str
    title: str
    tuber: str


@app.get("/vids")
async def get_vids():
    ret = []
    async for r in db.iterate("select * from vids"):
        ret.append(r)
    
    return ret


@app.post("/")
async def post_vid(vid: Vid):
    args = {"at": int(time.time())}
    args.update(vid)
    async with db.transaction():
        q = "insert into vids values(:at,:nick,:vid,:title,:tuber)"
        await db.execute(q, args)


@app.get("/", response_class=HTMLResponse)
async def get_index():
    vids = await get_vids()
    if not vids:
        return "db empty"
    
    keys = list(vids[0].keys())
    ret = "<table><tr><td>"
    ret += "</td><td>".join(k for k in keys)
    ret = [ret + "</td></tr>"]
    for r in vids:
        line = "<tr><td>"
        line += "</td><td>".join(str(r[k]) for k in keys)
        ret.append(line + "</td></tr>")

    return "\n".join(ret) + "</table>"
