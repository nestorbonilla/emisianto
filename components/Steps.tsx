import Image from "next/image";

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Steps({steps, children}) {
  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {steps.map((step, stepIdx) => (
          <li key={step.id}>
            <div className="relative pb-8">
              {stepIdx !== steps.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-onyx" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={classNames(
                      step.active ? "bg-forest" : "bg-gypsum",
                      'h-8 w-8 flex items-center justify-center ring-1 ring-onyx'
                    )}
                  >
                    {step.active ? 
                      <step.iconActive className="h-5 w-5 text-snow" aria-hidden="true" /> :
                      <step.iconInactive className="h-5 w-5 text-onyx" aria-hidden="true" />
                    }
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-onyx">
                      {step.content}
                    </p>
                  </div>
                </div>
              </div>
              <div className="pl-11 pt-4">
                {children}
              </div>
            </div>
          </li>
        ))}
      </ul>
  </div>
  );
}