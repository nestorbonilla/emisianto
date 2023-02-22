import Image from "next/image";
import {AiFillGithub} from "react-icons/ai";

export default function SessionCard({session, username}) {
  return (
    <div className="flex flex-col relative items-center bg-white border border-onyx shadow md:flex-row md:max-w-xl dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            <div className="absolute top-3 right-3">
              <AiFillGithub className="w-5 h-5" />
            </div>
            <Image
              className="object-cover w-full h-96 md:h-auto md:w-48"
              src={session.user?.image}
              alt={session.user?.name}
              width={100}
              height={100}
            />
            <div className="flex flex-col justify-between p-4 leading-normal">
                <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{username}</h5>
                <div className="mb-3 font-normal text-gray-700 dark:text-gray-400">
                  <ul>
                    <li>Name: {session.user?.name}</li>
                    <li>Session expiration: {new Date(session.expires).toDateString()}</li>
                  </ul>
                </div>
            </div>
          </div>
  );
}